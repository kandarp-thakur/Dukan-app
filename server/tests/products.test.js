const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Product Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `powner${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const productPayload = {
    name: 'Rice 1kg',
    purchasePrice: 4000,
    sellingPrice: 5500,
    stockQty: 20,
    lowStockThreshold: 5,
};

describe('Products API', () => {
    it('creates a product scoped to the business', async () => {
        const data = await registerBusiness('A');
        const res = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send(productPayload);
        expect(res.status).toBe(201);
        expect(res.body.data.product.name).toBe('Rice 1kg');
        expect(res.body.data.product.lowStock).toBe(false);
    });

    it('lists only the caller business products', async () => {
        const dataA = await registerBusiness('B');
        const dataB = await registerBusiness('C');
        await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${dataA.accessToken}`)
            .send(productPayload);
        await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ ...productPayload, name: 'Only B Product' });
        const res = await request(app)
            .get('/api/v1/products')
            .set('Authorization', `Bearer ${dataB.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.products).toHaveLength(1);
        expect(res.body.data.products[0].name).toBe('Only B Product');
    });

    it('updates a product', async () => {
        const data = await registerBusiness('D');
        const created = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send(productPayload);
        const id = created.body.data.product.id;
        const res = await request(app)
            .patch(`/api/v1/products/${id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ sellingPrice: 6000, stockQty: 3 });
        expect(res.status).toBe(200);
        expect(res.body.data.product.sellingPrice).toBe(6000);
        expect(res.body.data.product.lowStock).toBe(true);
    });

    it('deletes a product (owner only)', async () => {
        const data = await registerBusiness('E');
        const created = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send(productPayload);
        const id = created.body.data.product.id;
        const res = await request(app)
            .delete(`/api/v1/products/${id}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        const gone = await Product.findById(id);
        expect(gone).toBeNull();
    });

    it('returns 404 when updating another business product', async () => {
        const dataA = await registerBusiness('F');
        const dataB = await registerBusiness('G');
        const created = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${dataA.accessToken}`)
            .send(productPayload);
        const id = created.body.data.product.id;
        const res = await request(app)
            .patch(`/api/v1/products/${id}`)
            .set('Authorization', `Bearer ${dataB.accessToken}`)
            .send({ name: 'Stolen' });
        expect(res.status).toBe(404);
    });

    it('lists low-stock products', async () => {
        const data = await registerBusiness('H');
        await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ ...productPayload, name: 'Low Item', stockQty: 2, lowStockThreshold: 5 });
        await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ ...productPayload, name: 'Fine Item', stockQty: 50, lowStockThreshold: 5 });
        const res = await request(app)
            .get('/api/v1/products/low-stock')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.products).toHaveLength(1);
        expect(res.body.data.products[0].name).toBe('Low Item');
    });

    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/v1/products');
        expect(res.status).toBe(401);
    });

    it('rejects invalid payload with 400', async () => {
        const data = await registerBusiness('I');
        const res = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'No Prices' });
        expect(res.status).toBe(400);
        expect(res.body.errors.length).toBeGreaterThan(0);
    });
});
