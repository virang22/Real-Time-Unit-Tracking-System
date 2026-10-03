import nodemailer, { Transporter } from "nodemailer";
import { MailOptions, SMTPConfig } from "../types/smtp.interfaces";
import env from "./validate-env";

const smtpConfig: SMTPConfig = {
    service: env.SMTP_SERVICE,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
        user: env.SMTP_EMAIL,
        pass: env.SMTP_PASSWORD,
    },
    tls: {
        rejectUnauthorized: env.SMTP_SECURE,
    },
};

const transporter: Transporter = nodemailer.createTransport(smtpConfig);

export const sendEmail = (mailOptions: MailOptions) => {
    transporter.sendMail({ from: env.SMTP_EMAIL, ...mailOptions });
};
