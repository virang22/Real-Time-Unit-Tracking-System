import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import ElectricityBill from '../models/electricity-bill.model';
import Logger from '../utils/logger.service';
import env from '../utils/validate-env';

const paymentRouter = Router();

function getUserId(req: Request): string | undefined {
    return (req as Request & { userId?: string }).userId;
}

// 1. Get Razorpay configuration status and public Key ID
paymentRouter.get('/config', (_req: Request, res: Response) => {
    const isConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
    res.json({
        success: true,
        keyId: env.RAZORPAY_KEY_ID || '',
        isConfigured,
        currency: 'INR',
    });
});

// 2. Create Razorpay Order
paymentRouter.post('/create-order', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { amount, billId, purpose = 'bill' } = req.body;
        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount for payment order' });
        }

        const amountInPaisa = Math.round(numericAmount * 100);

        // If Razorpay keys are configured, create real order with Razorpay API
        if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
            const razorpay = new Razorpay({
                key_id: env.RAZORPAY_KEY_ID,
                key_secret: env.RAZORPAY_KEY_SECRET,
            });

            const receiptId = `rcpt_${String(billId || Date.now()).slice(-20)}`;
            const order = await razorpay.orders.create({
                amount: amountInPaisa,
                currency: 'INR',
                receipt: receiptId,
                notes: {
                    userId,
                    billId: String(billId || ''),
                    purpose: String(purpose),
                },
            });

            return res.json({
                success: true,
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: env.RAZORPAY_KEY_ID,
                isReal: true,
            });
        }

        // Fallback simulation order if keys are not configured yet
        return res.json({
            success: true,
            orderId: `order_sim_${Date.now()}`,
            amount: amountInPaisa,
            currency: 'INR',
            keyId: 'rzp_test_placeholder',
            isReal: false,
            message: 'Razorpay keys not configured in backend/.env yet. Using test order simulation.',
        });
    } catch (error) {
        Logger.error('Error creating Razorpay order:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create payment order',
        });
    }
});

// 3. Verify Payment Signature and update Bill / Wallet
paymentRouter.post('/verify', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            billId,
            purpose = 'bill',
        } = req.body;

        if (!razorpay_payment_id) {
            return res.status(400).json({ error: 'razorpay_payment_id is required' });
        }

        // If real Razorpay keys are configured, verify HMAC signature
        if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
            if (!razorpay_order_id || !razorpay_signature) {
                return res.status(400).json({ error: 'Missing order_id or signature for verification' });
            }

            const hmac = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET);
            hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
            const expectedSignature = hmac.digest('hex');

            if (expectedSignature !== razorpay_signature) {
                Logger.error('Razorpay signature verification failed for payment:', razorpay_payment_id);
                return res.status(400).json({ error: 'Payment signature verification failed' });
            }
        }

        // Update Electricity Bill if billId is provided
        if (billId) {
            const bill = await ElectricityBill.findOne({ _id: billId });
            if (bill) {
                bill.status = 'PAID';
                bill.transactionId = razorpay_payment_id;
                bill.paymentMethod = 'RAZORPAY';
                bill.paidAt = new Date();
                await bill.save();
                Logger.info(`Bill ${billId} marked as PAID via Razorpay (${razorpay_payment_id})`);
            }
        }

        res.json({
            success: true,
            message: 'Payment verified successfully and recorded',
            transactionId: razorpay_payment_id,
            purpose,
        });
    } catch (error) {
        Logger.error('Error verifying Razorpay payment:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Payment verification failed',
        });
    }
});

export default paymentRouter;
