import { Router } from 'express';
import authRouter from './auth.routes';
import liveDataRouter from './live-data.routes';
import alertRouter from './alert.routes';
import deviceRouter from './device.routes';
import adminRouter from './admin.routes'; // dev‑only admin routes
import electricityBillRouter from './electricity-bill.routes';
import { authenticateToken } from '../middlewares/auth.middleware';

const indexRouter = Router();

indexRouter.use('/auth', authRouter);
indexRouter.use('/live-data', liveDataRouter);
indexRouter.use('/alerts', authenticateToken, alertRouter);
indexRouter.use('/devices', authenticateToken, deviceRouter);
indexRouter.use('/bills', authenticateToken, electricityBillRouter);
// Development‑only admin endpoint – only active when not in production
if (process.env.NODE_ENV !== 'production') {
  indexRouter.use('/admin', adminRouter);
}
export default indexRouter;