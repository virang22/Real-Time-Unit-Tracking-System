import fs from 'fs';
import path from 'path';
import { SendForgotPasswordMailParams } from '../types/smtp.interfaces';
import { sendEmail } from './smtp.service';

/**
 * Send a forgot password email to a user with their new password
 * @param params Object containing name, email, password
 */
export const sendForgotPasswordMail = ({ name, email, password }: SendForgotPasswordMailParams) => {
    try {
        // Read the HTML template
        const templatePath = path.join(__dirname, '../contents/forgot-password-mail.html');
        let html = fs.readFileSync(templatePath, 'utf-8');

        // Replace placeholders
        html = html
            .replace(/{{name}}/g, name)
            .replace(/{{email}}/g, email)
            .replace(/{{password}}/g, password);

        // Send the email
        sendEmail({
            to: email,
            subject: 'Password Reset - Networked AI',
            html
        });
    } catch (error) {
        console.error('Error in sendForgotPasswordMail:', error);
        throw error;
    }
};