const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Sale Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `sowner${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const createProduct = async (token, name = 'Rice 1kg', stockQty = 10) => {
    const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, purchasePrice: 4000, sellingPrice: 5500, stockQty });
    return res.body.data.product;
};

const setBusinessGstin = async (token, gstin) => {
    await request(app)
        .patch('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ gstin });
};

const createCustomer = async (token, name = 'Ramesh', gstin = '', address = '') => {
    const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, phone: '9812345678', gstin, address });
    return res.body.data.customer;
};

describe('Sales API', () => {
    it('creates a cash sale: decrements stock, assigns invoice number, no khata entry', async () => {
        const data = await registerBusiness('A');
        const product = await createProduct(data.accessToken, 'Rice 1kg', 10);
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ productId: product.id, name: 'Rice 1kg', qty: 2, rate: 5500 }],
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        expect(res.body.data.sale.invoiceNumber).toBe('INV-1');
        expect(res.body.data.sale.total).toBe(11000);
        const updated = await Product.findById(product.id);
        expect(updated.stockQty).toBe(8);
        const khataRes = await request(app)
            .get(`/api/v1/customers`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(khataRes.body.data.customers).toHaveLength(0);
    });

    it('creates a credit sale: decrements stock and creates khata credit entry', async () => {
        const data = await registerBusiness('B');
        const product = await createProduct(data.accessToken, 'Oil 1L', 5);
        const customer = await createCustomer(data.accessToken);
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ productId: product.id, name: 'Oil 1L', qty: 1, rate: 12000 }],
                paymentMethod: 'credit',
                customerId: customer.id,
            });
        expect(res.status).toBe(201);
        const khataRes = await request(app)
            .get(`/api/v1/customers/${customer.id}/khata`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(khataRes.body.data.balance).toBe(12000);
        const entries = khataRes.body.data.entries;
        expect(entries).toHaveLength(1);
        expect(entries[0].type).toBe('credit');
        expect(entries[0].amount).toBe(12000);
    });

    it('increments the invoice counter per business', async () => {
        const data = await registerBusiness('C');
        const p = await createProduct(data.accessToken);
        const s1 = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ items: [{ productId: p.id, name: 'Rice 1kg', qty: 1, rate: 100 }], paymentMethod: 'cash' });
        const s2 = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ items: [{ name: 'Service', qty: 1, rate: 200 }], paymentMethod: 'upi' });
        expect(s1.body.data.sale.invoiceNumber).toBe('INV-1');
        expect(s2.body.data.sale.invoiceNumber).toBe('INV-2');
    });

    it('rejects a sale that exceeds available stock', async () => {
        const data = await registerBusiness('D');
        const product = await createProduct(data.accessToken, 'Atta 5kg', 3);
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ productId: product.id, name: 'Atta 5kg', qty: 5, rate: 25000 }],
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/stock/i);
    });

    it('rejects a credit sale without a customer', async () => {
        const data = await registerBusiness('E');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ items: [{ name: 'Item', qty: 1, rate: 500 }], paymentMethod: 'credit' });
        expect(res.status).toBe(400);
    });

    it('lists sales with computed totals, newest first', async () => {
        const data = await registerBusiness('F');
        await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ items: [{ name: 'Pen', qty: 2, rate: 1000 }], paymentMethod: 'cash' });
        await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ items: [{ name: 'Book', qty: 1, rate: 5000 }], paymentMethod: 'upi' });
        const res = await request(app)
            .get('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.sales).toHaveLength(2);
        expect(res.body.data.sales[0].total).toBe(5000);
    });

    it('returns 404 for another business sale', async () => {
        const dataA = await registerBusiness('G');
        const dataB = await registerBusiness('H');
        await createProduct(dataA.accessToken);
        const sale = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${dataA.accessToken}`)
            .send({ items: [{ name: 'Item', qty: 1, rate: 300 }], paymentMethod: 'cash' });
        const res = await request(app)
            .get(`/api/v1/sales/${sale.body.data.sale.id}`)
            .set('Authorization', `Bearer ${dataB.accessToken}`);
        expect(res.status).toBe(404);
    });

    it('cancels a sale: restores stock and reverses khata credit', async () => {
        const data = await registerBusiness('I');
        const product = await createProduct(data.accessToken, 'Soap', 6);
        const customer = await createCustomer(data.accessToken, 'Suresh');
        const sale = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ productId: product.id, name: 'Soap', qty: 4, rate: 3000 }],
                paymentMethod: 'credit',
                customerId: customer.id,
            });
        const res = await request(app)
            .patch(`/api/v1/sales/${sale.body.data.sale.id}/cancel`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.sale.status).toBe('cancelled');
        const updated = await Product.findById(product.id);
        expect(updated.stockQty).toBe(6);
        const khataRes = await request(app)
            .get(`/api/v1/customers/${customer.id}/khata`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(khataRes.body.data.balance).toBe(0);
    });
});

describe('Expenses API', () => {
    it('creates and lists expenses scoped to business', async () => {
        const dataA = await registerBusiness('J');
        const dataB = await registerBusiness('K');
        await request(app)
            .post('/api/v1/expenses')
            .set('Authorization', `Bearer ${dataA.accessToken}`)
            .send({ category: 'rent', amount: 1500000, paymentMethod: 'cash', note: 'Shop rent' });
        await request(app)
            .post('/api/v1/expenses')
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ category: 'electricity', amount: 250000, paymentMethod: 'upi' });
        const res = await request(app)
            .get('/api/v1/expenses')
            .set('Authorization', `Bearer ${dataA.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.expenses).toHaveLength(1);
        expect(res.body.data.expenses[0].category).toBe('rent');
    });

    it('updates an expense', async () => {
        const data = await registerBusiness('L');
        const expense = await request(app)
            .post('/api/v1/expenses')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ category: 'transport', amount: 30000, paymentMethod: 'cash' });
        const res = await request(app)
            .patch(`/api/v1/expenses/${expense.body.data.expense.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ amount: 45000, note: 'Tempo hire' });
        expect(res.status).toBe(200);
        expect(res.body.data.expense.amount).toBe(45000);
        expect(res.body.data.expense.note).toBe('Tempo hire');
    });

    it('deletes an expense (owner-only)', async () => {
        const data = await registerBusiness('M');
        const expense = await request(app)
            .post('/api/v1/expenses')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ category: 'other', amount: 1000, paymentMethod: 'cash' });
        const res = await request(app)
            .delete(`/api/v1/expenses/${expense.body.data.expense.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        const list = await request(app)
            .get('/api/v1/expenses')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(list.body.data.expenses).toHaveLength(0);
    });

    it('rejects invalid amounts and categories', async () => {
        const data = await registerBusiness('N');
        const res = await request(app)
            .post('/api/v1/expenses')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ category: 'party', amount: -500, paymentMethod: 'cash' });
        expect(res.status).toBe(400);
    });

    it('returns 404 for another business expense', async () => {
        const dataA = await registerBusiness('O');
        const dataB = await registerBusiness('P');
        const expense = await request(app)
            .post('/api/v1/expenses')
            .set('Authorization', `Bearer ${dataA.accessToken}`)
            .send({ category: 'salary', amount: 500000, paymentMethod: 'upi' });
        const res = await request(app)
            .patch(`/api/v1/expenses/${expense.body.data.expense.id}`)
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ amount: 1 });
        expect(res.status).toBe(404);
    });
});

describe('GST sales', () => {
    it('creates an intra-state GST sale with buyer snapshot and CGST/SGST', async () => {
        const data = await registerBusiness('G1');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const customer = await createCustomer(
            data.accessToken,
            'Ramesh',
            '27XYZAB5678C1Z9',
            'MG Road, Pune'
        );
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                customerId: customer.id,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        const sale = res.body.data.sale;
        expect(sale.isGst).toBe(true);
        expect(sale.tax).toBe(1980);
        expect(sale.cgst).toBe(990);
        expect(sale.sgst).toBe(990);
        expect(sale.igst).toBe(0);
        expect(sale.total).toBe(12980);
        expect(sale.buyerName).toBe('Ramesh');
        expect(sale.buyerGstin).toBe('27XYZAB5678C1Z9');
        expect(sale.buyerAddress).toBe('MG Road, Pune');
        expect(sale.placeOfSupply).toBe('MH');
    });

    it('falls back to the business state when the buyer GSTIN state code is unknown', async () => {
        const data = await registerBusiness('G7');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                buyerGstin: 'ZZABCDE1234F1Z5',
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        const sale = res.body.data.sale;
        expect(sale.placeOfSupply).toBe('MH');
        expect(sale.cgst).toBe(990);
        expect(sale.sgst).toBe(990);
        expect(sale.igst).toBe(0);
    });

    it('charges IGST for an inter-state GST sale', async () => {
        const data = await registerBusiness('G2');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                placeOfSupply: 'KA',
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        expect(res.body.data.sale.igst).toBe(1980);
        expect(res.body.data.sale.cgst).toBe(0);
        expect(res.body.data.sale.sgst).toBe(0);
    });

    it('rejects a GST sale when the business has no GSTIN', async () => {
        const data = await registerBusiness('G3');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 1, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/business GSTIN/i);
    });

    it('rejects a taxed item without an HSN code', async () => {
        const data = await registerBusiness('G4');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 1, rate: 5500, gstRate: 18 }],
                isGst: true,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/HSN/i);
    });

    it('rejects an unsupported GST rate', async () => {
        const data = await registerBusiness('G5');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 1, rate: 5500, gstRate: 7, hsn: '1006' }],
                isGst: true,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
    });

    it('snapshots buyerName on a non-GST sale but keeps zero tax', async () => {
        const data = await registerBusiness('G6');
        const customer = await createCustomer(data.accessToken, 'Suresh');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Pen', qty: 2, rate: 1000 }],
                paymentMethod: 'cash',
                customerId: customer.id,
            });
        expect(res.status).toBe(201);
        const sale = res.body.data.sale;
        expect(sale.isGst).toBe(false);
        expect(sale.cgst).toBe(0);
        expect(sale.sgst).toBe(0);
        expect(sale.igst).toBe(0);
        expect(sale.total).toBe(2000);
        expect(sale.buyerName).toBe('Suresh');
    });
});
