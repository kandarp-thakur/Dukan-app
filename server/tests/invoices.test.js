const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Invoice Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `iowner${suffix}@test.com`,
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

describe('Invoices API', () => {
    it('lists invoices with search, type filter and date range', async () => {
        const data = await registerBusiness('A');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        await createSale(data.accessToken, {
            items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
            isGst: true,
            buyerName: 'Ramesh',
            paymentMethod: 'cash',
            date: '2026-09-01T10:00:00.000Z',
        });
        await createSale(data.accessToken, {
            items: [{ name: 'Pen', qty: 2, rate: 500 }],
            buyerName: 'Suresh',
            paymentMethod: 'cash',
            date: '2026-09-10T10:00:00.000Z',
        });

        const all = await request(app).get('/api/v1/invoices').set(auth(data.accessToken));
        expect(all.status).toBe(200);
        expect(all.body.data.invoices).toHaveLength(2);
        expect(all.body.data.invoices[0].invoiceNumber).toBe('INV-2');
        expect(all.body.data.invoices[0].isGst).toBe(false);

        const gstOnly = await request(app)
            .get('/api/v1/invoices?type=gst')
            .set(auth(data.accessToken));
        expect(gstOnly.body.data.invoices).toHaveLength(1);
        expect(gstOnly.body.data.invoices[0].isGst).toBe(true);

        const byBuyer = await request(app)
            .get('/api/v1/invoices?q=suresh')
            .set(auth(data.accessToken));
        expect(byBuyer.body.data.invoices).toHaveLength(1);
        expect(byBuyer.body.data.invoices[0].buyerName).toBe('Suresh');

        const byNumber = await request(app)
            .get('/api/v1/invoices?q=INV-1')
            .set(auth(data.accessToken));
        expect(byNumber.body.data.invoices).toHaveLength(1);

        const ranged = await request(app)
            .get('/api/v1/invoices?from=2026-09-05T00:00:00.000Z&to=2026-09-30T00:00:00.000Z')
            .set(auth(data.accessToken));
        expect(ranged.body.data.invoices).toHaveLength(1);
        expect(ranged.body.data.invoices[0].invoiceNumber).toBe('INV-2');
    });

    it('rejects a range where to is before from', async () => {
        const data = await registerBusiness('B');
        const res = await request(app)
            .get('/api/v1/invoices?from=2026-09-10T00:00:00.000Z&to=2026-09-01T00:00:00.000Z')
            .set(auth(data.accessToken));
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("'to' must be after 'from'");
    });

    it('returns a single invoice with a business snapshot', async () => {
        const data = await registerBusiness('C');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const sale = await createSale(data.accessToken, {
            items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
            isGst: true,
            paymentMethod: 'cash',
        });
        const res = await request(app)
            .get(`/api/v1/invoices/${sale.id}`)
            .set(auth(data.accessToken));
        expect(res.status).toBe(200);
        expect(res.body.data.invoice.invoiceNumber).toBe('INV-1');
        expect(res.body.data.invoice.cgst).toBe(900);
        expect(res.body.data.business.gstin).toBe('27ABCDE1234F1Z5');
    });

    it('keeps invoices tenant-scoped', async () => {
        const dataA = await registerBusiness('D');
        const dataB = await registerBusiness('E');
        const sale = await createSale(dataA.accessToken, {
            items: [{ name: 'Pen', qty: 1, rate: 1000 }],
            paymentMethod: 'cash',
        });
        const list = await request(app).get('/api/v1/invoices').set(auth(dataB.accessToken));
        expect(list.body.data.invoices).toHaveLength(0);
        const get = await request(app)
            .get(`/api/v1/invoices/${sale.id}`)
            .set(auth(dataB.accessToken));
        expect(get.status).toBe(404);
    });
});
