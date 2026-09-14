const nodemailer = require('nodemailer');

// The only module that knows about SMTP. Swapping providers means rewriting this file.
const REQUIRED_ENV = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

const isEmailConfigured = () =>
    REQUIRED_ENV.every((key) => Boolean(process.env[key] && String(process.env[key]).trim()));

const buildTransport = () =>
    nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE) === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

const sendInvoiceEmail = async ({ to, subject, html, pdf, fileName }) => {
    if (!isEmailConfigured()) {
        const err = new Error('Email is not configured');
        err.status = 503;
        throw err;
    }

    const transport = buildTransport();
    try {
        return await transport.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
            attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }],
        });
    } catch (cause) {
        // Keep the raw SMTP error on the server; never surface it to the client.
        console.error('sendInvoiceEmail failed:', cause);
        const err = new Error('Could not send email');
        err.status = 502;
        throw err;
    }
};

module.exports = { isEmailConfigured, sendInvoiceEmail };
