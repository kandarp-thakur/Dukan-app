const nodemailer = require('nodemailer');
const { isEmailConfigured, sendInvoiceEmail } = require('../src/services/emailService');
const { invoiceEmailHtml } = require('../src/services/emailTemplates');
const { formatINR, amountToWords } = require('../src/utils/money');

jest.mock('nodemailer');

const setSmtpEnv = (on) => {
    const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    keys.forEach((key) => {
        if (on) process.env[key] = `test-${key.toLowerCase()}`;
        else delete process.env[key];
    });
};

describe('emailService', () => {
    let sendMail;

    // The suite runs with --runInBand, so all test files share one process. Capture the
    // env keys this file mutates and restore them after each test so SMTP settings cannot
    // leak into later test files. If a key was originally unset we delete it rather than
    // storing the string 'undefined'.
    const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
    const originalEnv = SMTP_KEYS.map((key) => [key, process.env[key]]);

    afterEach(() => {
        originalEnv.forEach(([key, value]) => {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        });
    });

    // The 502 test deliberately drives a transport failure, and the service logs the raw
    // SMTP error server-side on purpose. Silence that expected log so test output stays clean.
    let errorSpy;
    beforeEach(() => {
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        sendMail = jest.fn().mockResolvedValue({ accepted: ['a@b.com'] });
        nodemailer.createTransport.mockReturnValue({ sendMail });
        delete process.env.MAIL_FROM;
    });

    it('reports unconfigured when SMTP env is missing', () => {
        setSmtpEnv(false);
        expect(isEmailConfigured()).toBe(false);
    });

    it('reports configured when all SMTP env vars are set', () => {
        setSmtpEnv(true);
        expect(isEmailConfigured()).toBe(true);
    });

    it('rejects with 503 when unconfigured', async () => {
        setSmtpEnv(false);
        await expect(
            sendInvoiceEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', pdf: Buffer.from('x'), fileName: 'INV-1.pdf' })
        ).rejects.toMatchObject({ status: 503, message: 'Email is not configured' });
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('sends the PDF as an attachment', async () => {
        setSmtpEnv(true);
        const pdf = Buffer.from('%PDF-1.4 test');
        const result = await sendInvoiceEmail({
            to: 'a@b.com',
            subject: 'Invoice INV-1',
            html: '<p>hello</p>',
            pdf,
            fileName: 'INV-1.pdf',
        });

        expect(result).toEqual({ accepted: ['a@b.com'] });
        expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
        expect(sendMail).toHaveBeenCalledTimes(1);
        const mail = sendMail.mock.calls[0][0];
        expect(mail.to).toBe('a@b.com');
        expect(mail.subject).toBe('Invoice INV-1');
        expect(mail.html).toBe('<p>hello</p>');
        expect(mail.from).toBe('test-smtp_user');
        expect(mail.attachments).toHaveLength(1);
        expect(mail.attachments[0]).toMatchObject({
            filename: 'INV-1.pdf',
            contentType: 'application/pdf',
            content: pdf,
        });
    });

    it('prefers MAIL_FROM over the SMTP user as the sender', async () => {
        setSmtpEnv(true);
        process.env.MAIL_FROM = 'billing@shop.com';
        await sendInvoiceEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', pdf: Buffer.from('x'), fileName: 'i.pdf' });
        expect(sendMail.mock.calls[0][0].from).toBe('billing@shop.com');
    });

    it('wraps a transport failure as a 502 without leaking the transport error', async () => {
        setSmtpEnv(true);
        sendMail.mockRejectedValue(new Error('535 auth failed for user x'));
        await expect(
            sendInvoiceEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', pdf: Buffer.from('x'), fileName: 'i.pdf' })
        ).rejects.toMatchObject({ status: 502, message: 'Could not send email' });
    });
});

describe('invoiceEmailHtml', () => {
    const business = { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' };
    const invoice = { invoiceNumber: 'INV-9', total: 12980, date: '2026-09-05T10:30:00.000Z' };

    it('includes the business, invoice number, total and link', () => {
        const html = invoiceEmailHtml({ business, invoice, link: 'https://x.test/i/abc' });
        expect(html).toContain('Local Test Shop');
        expect(html).toContain('INV-9');
        expect(html).toContain('₹129.80');
        expect(html).toContain('https://x.test/i/abc');
    });

    it('omits the link button when there is no link', () => {
        const html = invoiceEmailHtml({ business, invoice, link: '' });
        expect(html).not.toContain('/i/');
    });
});

describe('server money utils', () => {
    it('formats paise as Indian Rupees with lakh/crore grouping', () => {
        expect(formatINR(0)).toBe('₹0');
        expect(formatINR(123456789)).toBe('₹12,34,567.89');
        expect(formatINR(10000000)).toBe('₹1,00,000');
        expect(formatINR(123400)).toBe('₹1,234');
        expect(formatINR(5500)).toBe('₹55');
        expect(formatINR(123455)).toBe('₹1,234.55');
    });

    it('handles negative amounts and paise-only formatting', () => {
        expect(formatINR(-5000)).toBe('-₹50');
        expect(formatINR(1050)).toBe('₹10.50');
        expect(formatINR(1005)).toBe('₹10.05');
    });

    it('converts paise to Indian number words', () => {
        expect(amountToWords(0)).toBe('Zero Rupees Only');
        expect(amountToWords(100000)).toBe('One Thousand Rupees Only');
        expect(amountToWords(5500)).toBe('Fifty Five Rupees Only');
        expect(amountToWords(123455)).toBe('One Thousand Two Hundred Thirty Four Rupees and Fifty Five Paise Only');
        expect(amountToWords(10000000)).toBe('One Lakh Rupees Only');
        expect(amountToWords(19900)).toBe('One Hundred Ninety Nine Rupees Only');
    });
});
