const request = require('supertest');
const app = require('../src/app');
const Customer = require('../src/models/Customer');
const KhataEntry = require('../src/models/KhataEntry');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Khata Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `kowner${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const createCustomer = async (token, name = 'Ramesh') => {
    const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, phone: '9876543210' });
    return res.body.data.customer;
};

describe('Customers API', () => {
    it('creates and lists customers scoped to business', async () => {
        const dataA = await registerBusiness('A');
        const dataB = await registerBusiness('B');
        await createCustomer(dataA.accessToken, 'A Customer');
        await createCustomer(dataB.accessToken, 'B Customer');
        const res = await request(app)
            .get('/api/v1/customers')
            .set('Authorization', `Bearer ${dataA.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.customers).toHaveLength(1);
        expect(res.body.data.customers[0].name).toBe('A Customer');
        expect(res.body.data.customers[0].balance).toBe(0);
    });

    it('updates and deletes a customer', async () => {
        const data = await registerBusiness('C');
        const customer = await createCustomer(data.accessToken);
        const upd = await request(app)
            .patch(`/api/v1/customers/${customer.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh Kumar', phone: '9999999999' });
        expect(upd.status).toBe(200);
        expect(upd.body.data.customer.name).toBe('Ramesh Kumar');
        const del = await request(app)
            .delete(`/api/v1/customers/${customer.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(del.status).toBe(200);
    });

    it('returns 404 for another business customer', async () => {
        const dataA = await registerBusiness('D');
        const dataB = await registerBusiness('E');
        const customer = await createCustomer(dataA.accessToken);
        const res = await request(app)
            .patch(`/api/v1/customers/${customer.id}`)
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ name: 'Steal' });
        expect(res.status).toBe(404);
    });

    it('creates and updates a customer with GSTIN and address', async () => {
        const data = await registerBusiness('GST');
        const created = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                name: 'Ramesh Traders',
                phone: '9812345678',
                gstin: '27XYZAB5678C1Z9',
                address: 'MG Road, Pune',
            });
        expect(created.status).toBe(201);
        expect(created.body.data.customer.gstin).toBe('27XYZAB5678C1Z9');
        expect(created.body.data.customer.address).toBe('MG Road, Pune');

        const updated = await request(app)
            .patch(`/api/v1/customers/${created.body.data.customer.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ address: 'FC Road, Pune' });
        expect(updated.status).toBe(200);
        expect(updated.body.data.customer.address).toBe('FC Road, Pune');
    });

    it('rejects a short GSTIN', async () => {
        const data = await registerBusiness('GST2');
        const res = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh', gstin: '123' });
        expect(res.status).toBe(400);
    });

    it('stores a customer email in lower case and returns it', async () => {
        const data = await registerBusiness('Email');
        const res = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh', email: '  Ramesh@Example.COM  ' });

        expect(res.status).toBe(201);
        expect(res.body.data.customer.email).toBe('ramesh@example.com');
    });

    it('updates a customer email', async () => {
        const data = await registerBusiness('EmailUpdate');
        const created = await createCustomer(data.accessToken, 'Suresh');
        const res = await request(app)
            .patch(`/api/v1/customers/${created.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ email: 'SURESH@Example.com' });

        expect(res.status).toBe(200);
        expect(res.body.data.customer.email).toBe('suresh@example.com');
    });
});

describe('Khata API', () => {
    it('records a payment and updates the customer balance', async () => {
        const data = await registerBusiness('F');
        const customer = await createCustomer(data.accessToken);
        // credit entry directly (simulating a credit sale)
        await KhataEntry.create({
            businessId: data.business.id,
            customerId: customer.id,
            type: 'credit',
            amount: 25000,
            note: 'credit sale',
        });
        const res = await request(app)
            .post('/api/v1/khata/payments')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ customerId: customer.id, amount: 10000, note: 'part payment' });
        expect(res.status).toBe(201);
        expect(res.body.data.entry.type).toBe('payment');
        const updated = await Customer.findById(customer.id);
        // balance = credits - payments = 25000 - 10000
        expect(updated.balance).toBe(15000);
    });

    it('rejects payment to another business customer', async () => {
        const dataA = await registerBusiness('G');
        const dataB = await registerBusiness('H');
        const customer = await createCustomer(dataA.accessToken);
        const res = await request(app)
            .post('/api/v1/khata/payments')
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ customerId: customer.id, amount: 100 });
        expect(res.status).toBe(404);
    });

    it('returns the khata statement with running balance', async () => {
        const data = await registerBusiness('I');
        const customer = await createCustomer(data.accessToken);
        await KhataEntry.create({
            businessId: data.business.id,
            customerId: customer.id,
            type: 'credit',
            amount: 20000,
        });
        await KhataEntry.create({
            businessId: data.business.id,
            customerId: customer.id,
            type: 'payment',
            amount: 5000,
        });
        const res = await request(app)
            .get(`/api/v1/customers/${customer.id}/khata`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.entries).toHaveLength(2);
        expect(res.body.data.balance).toBe(15000);
        // entries ordered oldest first: credit then payment
        expect(res.body.data.entries[0].type).toBe('credit');
        expect(res.body.data.entries[1].type).toBe('payment');
    });

    it('rejects invalid payment amounts', async () => {
        const data = await registerBusiness('J');
        const customer = await createCustomer(data.accessToken);
        const res = await request(app)
            .post('/api/v1/khata/payments')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ customerId: customer.id, amount: 0 });
        expect(res.status).toBe(400);
    });
});
