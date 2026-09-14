const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');
const { isTokenExpired } = require('../src/utils/shareToken');

jest.mock('../src/services/emailService', () => ({
    isEmailConfigured: jest.fn(() => true),
    sendInvoiceEmail: jest.fn(),
}));

const emailService = require('../src/services/emailService');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Delivery Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `downer${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const setBusinessGstin = async (token, gstin) => {
    await request(app)
        .patch('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ gstin });
};

const createSale = async (token, payload) => {
    const res = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
    return res.body.data.sale;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const onePen = { items: [{ name: 'Pen', qty: 1, rate: 1000 }], paymentMethod: 'cash' };

const pdfBuffer = (size = 64) => {
    const buf = Buffer.alloc(size, 0x20);
    Buffer.from('%PDF-1.4').copy(buf, 0);
    return buf;
};

describe('Invoice delivery API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        emailService.isEmailConfigured.mockReturnValue(true);
        emailService.sendInvoiceEmail.mockResolvedValue({ accepted: ['x@y.com'] });
    });

    it('emails an invoice with the PDF attachment', async () => {
        const data = await registerBusiness('A');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'INV-1.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(emailService.sendInvoiceEmail).toHaveBeenCalledTimes(1);
        const args = emailService.sendInvoiceEmail.mock.calls[0][0];
        expect(args.to).toBe('buyer@example.com');
        expect(args.subject).toContain('INV-1');
        expect(args.subject).toContain('Delivery Shop A');
        expect(args.fileName).toBe('INV-1.pdf');
        expect(Buffer.isBuffer(args.pdf)).toBe(true);
        expect(args.html).toContain('INV-1');
    });

    it('returns 503 when email is not configured', async () => {
        emailService.isEmailConfigured.mockReturnValue(false);
        const err = new Error('Email is not configured');
        err.status = 503;
        emailService.sendInvoiceEmail.mockRejectedValue(err);
        const data = await registerBusiness('B');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(503);
        expect(res.body.message).toBe('Email is not configured');
    });

    it('returns 502 when the transport fails', async () => {
        const err = new Error('Could not send email');
        err.status = 502;
        emailService.sendInvoiceEmail.mockRejectedValue(err);
        const data = await registerBusiness('B2');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(502);
        expect(res.body.message).toBe('Could not send email');
    });

    it('rejects a non-PDF attachment with 400', async () => {
        const data = await registerBusiness('C');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('A PDF attachment is required');
        expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('rejects an attachment over 5 MB with 413', async () => {
        const data = await registerBusiness('D');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(5 * 1024 * 1024 + 1024), {
                filename: 'big.pdf',
                contentType: 'application/pdf',
            });

        expect(res.status).toBe(413);
        expect(res.body.message).toBe('Attachment exceeds 5 MB');
    });

    it('rejects a missing attachment with 400', async () => {
        const data = await registerBusiness('E');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('A PDF attachment is required');
    });

    it('rejects an invalid recipient with 400', async () => {
        const data = await registerBusiness('F');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'not-an-email')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(400);
        expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('does not let one business email another business invoice', async () => {
        const dataA = await registerBusiness('G');
        const dataB = await registerBusiness('H');
        const sale = await createSale(dataA.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(dataB.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(404);
        expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('creates a share link and rotates it on the next call', async () => {
        const data = await registerBusiness('I');
        const sale = await createSale(data.accessToken, onePen);

        const first = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        expect(first.status).toBe(200);
        expect(first.body.data.shareToken).toHaveLength(43);
        expect(first.body.data.shareUrl).toContain(`/i/${first.body.data.shareToken}`);
        expect(new Date(first.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

        const second = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        expect(second.body.data.shareToken).not.toBe(first.body.data.shareToken);
    });

    it('revokes a share link', async () => {
        const data = await registerBusiness('J');
        const sale = await createSale(data.accessToken, onePen);

        const created = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        const token = created.body.data.shareToken;

        const revoked = await request(app)
            .delete(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        expect(revoked.status).toBe(200);

        const publicRes = await request(app).get(`/api/v1/public/invoices/${token}`);
        expect(publicRes.status).toBe(404);
    });

    it('keeps share endpoints tenant-scoped', async () => {
        const dataA = await registerBusiness('K');
        const dataB = await registerBusiness('L');
        const sale = await createSale(dataA.accessToken, onePen);

        const share = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(dataB.accessToken));
        expect(share.status).toBe(404);

        const revoke = await request(app)
            .delete(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(dataB.accessToken));
        expect(revoke.status).toBe(404);
    });

    it('serves a public invoice without authentication and leaks nothing extra', async () => {
        const data = await registerBusiness('M');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const sale = await createSale(data.accessToken, {
            items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
            isGst: true,
            buyerName: 'Ramesh',
            buyerGstin: '27XYZAB5678C1Z9',
            paymentMethod: 'cash',
        });
        const created = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        const token = created.body.data.shareToken;

        const res = await request(app).get(`/api/v1/public/invoices/${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.invoice.invoiceNumber).toBe('INV-1');
        expect(res.body.data.invoice.total).toBe(11800);
        expect(res.body.data.invoice.cgst).toBe(900);
        expect(res.body.data.business.gstin).toBe('27ABCDE1234F1Z5');
        expect(res.body.data.invoice.status).toBe('completed');

        const serialized = JSON.stringify(res.body.data);
        expect(serialized).not.toContain('businessId');
        expect(serialized).not.toContain('customerId');
        expect(serialized).not.toContain('paymentMethod');
        expect(serialized).not.toContain('shareToken');
        expect(serialized).not.toContain('plan');
        expect(res.body.data.invoice.id).toBeUndefined();
        expect(res.body.data.invoice._id).toBeUndefined();
    });

    it('returns 404 for unknown, revoked and expired tokens', async () => {
        const data = await registerBusiness('N');
        const sale = await createSale(data.accessToken, onePen);

        const unknown = await request(app).get('/api/v1/public/invoices/definitely-not-real');
        expect(unknown.status).toBe(404);

        const created = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        const token = created.body.data.shareToken;

        const Sale = require('../src/models/Sale');
        await Sale.updateOne({ _id: sale.id }, { shareTokenExpiresAt: new Date(Date.now() - 1000) });
        const expired = await request(app).get(`/api/v1/public/invoices/${token}`);
        expect(expired.status).toBe(404);
    });

    it('reports the email feature flag', async () => {
        const data = await registerBusiness('O');
        emailService.isEmailConfigured.mockReturnValue(false);
        const off = await request(app).get('/api/v1/config/features').set(auth(data.accessToken));
        expect(off.status).toBe(200);
        expect(off.body.data.email).toBe(false);

        emailService.isEmailConfigured.mockReturnValue(true);
        const on = await request(app).get('/api/v1/config/features').set(auth(data.accessToken));
        expect(on.body.data.email).toBe(true);
    });

    it('requires auth for the feature flag', async () => {
        const res = await request(app).get('/api/v1/config/features');
        expect(res.status).toBe(401);
    });

    it('keeps isTokenExpired failing closed for a sale with no expiry', () => {
        expect(isTokenExpired({ shareTokenExpiresAt: null })).toBe(true);
    });
});
