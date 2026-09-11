const request = require('supertest');
const app = require('../src/app');
const Supplier = require('../src/models/Supplier');
const Product = require('../src/models/Product');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Supply Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `sowner${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const createSupplier = async (token, name = 'Wholesale Mart') => {
    const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, phone: '9123456780' });
    return res.body.data.supplier;
};

const createProduct = async (token) => {
    const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rice 1kg', purchasePrice: 4000, sellingPrice: 5500, stockQty: 0 });
    return res.body.data.product;
};

describe('Suppliers API', () => {
    it('creates and lists suppliers scoped to business', async () => {
        const dataA = await registerBusiness('A');
        const dataB = await registerBusiness('B');
        await createSupplier(dataA.accessToken, 'A Supplier');
        await createSupplier(dataB.accessToken, 'B Supplier');
        const res = await request(app)
            .get('/api/v1/suppliers')
            .set('Authorization', `Bearer ${dataA.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.suppliers).toHaveLength(1);
        expect(res.body.data.suppliers[0].name).toBe('A Supplier');
    });

    it('updates a supplier', async () => {
        const data = await registerBusiness('C');
        const supplier = await createSupplier(data.accessToken);
        const res = await request(app)
            .patch(`/api/v1/suppliers/${supplier.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Mega Wholesale', phone: '9000000000' });
        expect(res.status).toBe(200);
        expect(res.body.data.supplier.name).toBe('Mega Wholesale');
    });

    it('returns 404 for another business supplier', async () => {
        const dataA = await registerBusiness('D');
        const dataB = await registerBusiness('E');
        const supplier = await createSupplier(dataA.accessToken);
        const res = await request(app)
            .patch(`/api/v1/suppliers/${supplier.id}`)
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ name: 'Steal' });
        expect(res.status).toBe(404);
    });
});

describe('Purchases API', () => {
    it('creates a credit purchase: increments stock and supplier payable', async () => {
        const data = await registerBusiness('F');
        const supplier = await createSupplier(data.accessToken);
        const product = await createProduct(data.accessToken);
        const res = await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.id,
                items: [{ productId: product.id, name: 'Rice 1kg', qty: 10, cost: 4000 }],
                paymentMethod: 'credit',
            });
        expect(res.status).toBe(201);
        expect(res.body.data.purchase.total).toBe(40000);
        const updatedProduct = await Product.findById(product.id);
        expect(updatedProduct.stockQty).toBe(10);
        const updatedSupplier = await Supplier.findById(supplier.id);
        expect(updatedSupplier.balance).toBe(40000);
    });

    it('creates a cash purchase: increments stock but not payable', async () => {
        const data = await registerBusiness('G');
        const supplier = await createSupplier(data.accessToken);
        const product = await createProduct(data.accessToken);
        const res = await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.id,
                items: [{ productId: product.id, name: 'Rice 1kg', qty: 5, cost: 4000 }],
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        const updatedSupplier = await Supplier.findById(supplier.id);
        expect(updatedSupplier.balance).toBe(0);
        const updatedProduct = await Product.findById(product.id);
        expect(updatedProduct.stockQty).toBe(5);
    });

    it('rejects purchase for another business supplier', async () => {
        const dataA = await registerBusiness('H');
        const dataB = await registerBusiness('I');
        const supplier = await createSupplier(dataA.accessToken);
        const res = await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({
                supplierId: supplier.id,
                items: [{ name: 'X', qty: 1, cost: 100 }],
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(404);
    });

    it('lists purchases with populated supplier name', async () => {
        const data = await registerBusiness('J');
        const supplier = await createSupplier(data.accessToken);
        await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.id,
                items: [{ name: 'Item', qty: 2, cost: 500 }],
                paymentMethod: 'cash',
            });
        const res = await request(app)
            .get('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.purchases).toHaveLength(1);
        expect(res.body.data.purchases[0].supplierName).toBe('Wholesale Mart');
    });
});

describe('Supplier Payments API', () => {
    it('records a payment and reduces the payable balance', async () => {
        const data = await registerBusiness('K');
        const supplier = await createSupplier(data.accessToken);
        // credit purchase first
        await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.id,
                items: [{ name: 'Item', qty: 4, cost: 2500 }],
                paymentMethod: 'credit',
            });
        const res = await request(app)
            .post('/api/v1/supplier-payments')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ supplierId: supplier.id, amount: 5000, method: 'upi' });
        expect(res.status).toBe(201);
        const updated = await Supplier.findById(supplier.id);
        expect(updated.balance).toBe(5000);
    });

    it('rejects payment for another business supplier', async () => {
        const dataA = await registerBusiness('L');
        const dataB = await registerBusiness('M');
        const supplier = await createSupplier(dataA.accessToken);
        const res = await request(app)
            .post('/api/v1/supplier-payments')
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ supplierId: supplier.id, amount: 100, method: 'cash' });
        expect(res.status).toBe(404);
    });

    it('returns the supplier statement', async () => {
        const data = await registerBusiness('N');
        const supplier = await createSupplier(data.accessToken);
        await request(app)
            .post('/api/v1/purchases')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                supplierId: supplier.id,
                items: [{ name: 'Item', qty: 4, cost: 2500 }],
                paymentMethod: 'credit',
            });
        await request(app)
            .post('/api/v1/supplier-payments')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ supplierId: supplier.id, amount: 2000, method: 'cash' });
        const res = await request(app)
            .get(`/api/v1/suppliers/${supplier.id}/statement`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.balance).toBe(8000);
        expect(res.body.data.purchases).toHaveLength(1);
        expect(res.body.data.payments).toHaveLength(1);
    });
});
