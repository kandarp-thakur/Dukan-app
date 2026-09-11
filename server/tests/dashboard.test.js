const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Dash Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `downer${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const addSale = (token, items, paymentMethod, extra = {}) =>
    request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ items, paymentMethod, ...extra });

const addExpense = (token, amount, paymentMethod = 'cash', category = 'rent') =>
    request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({ category, amount, paymentMethod });

describe('Dashboard API', () => {
    it('computes today summary: sales, expenses, profit, cash balance', async () => {
        const data = await registerBusiness('A');
        const customer = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh', phone: '9812345678' });
        await addSale(data.accessToken, [{ name: 'Item A', qty: 1, rate: 10000 }], 'cash');
        await addSale(data.accessToken, [{ name: 'Item B', qty: 1, rate: 5000 }], 'upi');
        await addSale(
            data.accessToken,
            [{ name: 'Item C', qty: 1, rate: 2000 }],
            'credit',
            { customerId: customer.body.data.customer.id }
        );
        await addExpense(data.accessToken, 3000, 'cash');
        const res = await request(app)
            .get('/api/v1/dashboard/summary?range=today')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        const summary = res.body.data.summary;
        expect(summary.salesTotal).toBe(17000);
        expect(summary.expensesTotal).toBe(3000);
        expect(summary.profit).toBe(14000);
        expect(summary.cashBalance).toBe(12000);
        expect(summary.receivable).toBe(2000);
        expect(summary.payable).toBe(0);
    });

    it('month range includes the same day totals', async () => {
        const data = await registerBusiness('B');
        await addSale(data.accessToken, [{ name: 'Item', qty: 1, rate: 8000 }], 'card');
        const res = await request(app)
            .get('/api/v1/dashboard/summary?range=month')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.summary.salesTotal).toBe(8000);
        expect(res.body.data.summary.cashBalance).toBe(8000);
    });

    it('excludes credit sale totals from cash balance but includes them in sales total', async () => {
        const data = await registerBusiness('C');
        const customer = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Suresh', phone: '9812345678' });
        await addSale(
            data.accessToken,
            [{ name: 'Item', qty: 1, rate: 6000 }],
            'credit',
            { customerId: customer.body.data.customer.id }
        );
        const res = await request(app)
            .get('/api/v1/dashboard/summary?range=today')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.body.data.summary.salesTotal).toBe(6000);
        expect(res.body.data.summary.cashBalance).toBe(0);
        expect(res.body.data.summary.receivable).toBe(6000);
    });

    it('supplier payables reduce cash balance once paid', async () => {
        const data = await registerBusiness('D');
        const supplier = await request(app)
            .post('/api/v1/suppliers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Wholesaler', phone: '9123456780' });
        await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.body.data.supplier.id,
                items: [{ name: 'Stock goods', qty: 1, cost: 4000 }],
                paymentMethod: 'cash',
            });
        await request(app)
            .post('/api/v1/supplier-payments')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ supplierId: supplier.body.data.supplier.id, amount: 1000, method: 'cash' });
        const res = await request(app)
            .get('/api/v1/dashboard/summary?range=today')
            .set('Authorization', `Bearer ${data.accessToken}`);
        // Cash purchase -4000 and supplier payment -1000, no cash-in.
        expect(res.body.data.summary.cashBalance).toBe(-5000);
    });

    it('is scoped per business', async () => {
        const dataA = await registerBusiness('E');
        await registerBusiness('F');
        await addSale(dataA.accessToken, [{ name: 'Item', qty: 1, rate: 9000 }], 'cash');
        const res = await request(app)
            .get('/api/v1/dashboard/summary?range=today')
            .set('Authorization', `Bearer ${dataA.accessToken}`);
        expect(res.body.data.summary.salesTotal).toBe(9000);
    });
});

describe('Reports API', () => {
    it('daily report aggregates sales and expenses for a date', async () => {
        const data = await registerBusiness('G');
        await addSale(data.accessToken, [{ name: 'Item', qty: 1, rate: 7000 }], 'cash');
        await addExpense(data.accessToken, 2000, 'upi');
        const today = new Date().toISOString().slice(0, 10);
        const res = await request(app)
            .get(`/api/v1/reports/daily?date=${today}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.report.salesTotal).toBe(7000);
        expect(res.body.data.report.expensesTotal).toBe(2000);
        expect(res.body.data.report.profit).toBe(5000);
    });

    it('monthly report aggregates by month', async () => {
        const data = await registerBusiness('H');
        await addSale(data.accessToken, [{ name: 'Item', qty: 1, rate: 12000 }], 'cash');
        const month = new Date().toISOString().slice(0, 7);
        const res = await request(app)
            .get(`/api/v1/reports/monthly?month=${month}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.report.salesTotal).toBe(12000);
    });

    it('outstanding report lists customer receivables and supplier payables', async () => {
        const data = await registerBusiness('I');
        const customer = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh', phone: '9812345678' });
        await addSale(
            data.accessToken,
            [{ name: 'Item', qty: 1, rate: 4000 }],
            'credit',
            { customerId: customer.body.data.customer.id }
        );
        const supplier = await request(app)
            .post('/api/v1/suppliers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Wholesaler', phone: '9123456780' });
        await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.body.data.supplier.id,
                items: [{ name: 'Stock goods', qty: 1, cost: 2500 }],
                paymentMethod: 'credit',
            });
        const res = await request(app)
            .get('/api/v1/reports/outstanding')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.report.receivableTotal).toBe(4000);
        expect(res.body.data.report.payableTotal).toBe(2500);
        expect(res.body.data.report.receivables[0].name).toBe('Ramesh');
        expect(res.body.data.report.payables[0].name).toBe('Wholesaler');
    });

    it('denies reports to staff role', async () => {
        const data = await registerBusiness('J');
        await User.create({
            name: 'Staff Person',
            email: `staffj@test.com`,
            password: 'secret123',
            role: 'staff',
            businessId: data.user.businessId,
        });
        const login = await request(app).post('/api/v1/auth/login').send({
            email: 'staffj@test.com',
            password: 'secret123',
        });
        const res = await request(app)
            .get('/api/v1/reports/daily')
            .set('Authorization', `Bearer ${login.body.data.accessToken}`);
        expect(res.status).toBe(403);
    });
});
