const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Staff Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `stowner${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const createStaff = (token, name, email) =>
    request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, email, password: 'temp12345', role: 'staff' });

const loginStaff = (email) =>
    request(app).post('/api/v1/auth/login').send({ email, password: 'temp12345' });

describe('Staff (Users) API', () => {
    it('owner lists users of their business only', async () => {
        const dataA = await registerBusiness('A');
        const dataB = await registerBusiness('B');
        await createStaff(dataA.accessToken, 'Helper One', 'helper1@test.com');
        await createStaff(dataB.accessToken, 'Helper Two', 'helper2@test.com');
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${dataA.accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.users).toHaveLength(2);
        expect(res.body.data.users.map((u) => u.email)).toEqual(
            expect.arrayContaining([dataA.user.email, 'helper1@test.com'])
        );
    });

    it('owner creates a staff user who can log in', async () => {
        const data = await registerBusiness('C');
        const res = await createStaff(data.accessToken, 'Counter Boy', 'counter@test.com');
        expect(res.status).toBe(201);
        expect(res.body.data.user.role).toBe('staff');
        expect(res.body.data.user.passwordHash).toBeUndefined();
        const login = await loginStaff('counter@test.com');
        expect(login.status).toBe(200);
        expect(login.body.data.user.role).toBe('staff');
        expect(login.body.data.user.businessId).toBe(data.user.businessId);
    });

    it('rejects duplicate email', async () => {
        const data = await registerBusiness('D');
        const res = await createStaff(data.accessToken, 'Dup', data.user.email);
        expect(res.status).toBe(409);
    });

    it('owner changes a staff role', async () => {
        const data = await registerBusiness('E');
        const staff = await createStaff(data.accessToken, 'Manager', 'manager@test.com');
        const res = await request(app)
            .patch(`/api/v1/users/${staff.body.data.user.id}/role`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ role: 'owner' });
        expect(res.status).toBe(200);
        expect(res.body.data.user.role).toBe('owner');
    });

    it('owner cannot demote themselves', async () => {
        const data = await registerBusiness('F');
        const res = await request(app)
            .patch(`/api/v1/users/${data.user.id}/role`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ role: 'staff' });
        expect(res.status).toBe(400);
    });

    it('owner deletes a staff user', async () => {
        const data = await registerBusiness('G');
        const staff = await createStaff(data.accessToken, 'Temp', 'temp@test.com');
        const res = await request(app)
            .delete(`/api/v1/users/${staff.body.data.user.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(200);
        const list = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(list.body.data.users).toHaveLength(1);
    });

    it('owner cannot delete themselves', async () => {
        const data = await registerBusiness('H');
        const res = await request(app)
            .delete(`/api/v1/users/${data.user.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`);
        expect(res.status).toBe(400);
    });

    it('staff cannot access user management', async () => {
        const data = await registerBusiness('I');
        await createStaff(data.accessToken, 'Helper', 'helper3@test.com');
        const login = await loginStaff('helper3@test.com');
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${login.body.data.accessToken}`);
        expect(res.status).toBe(403);
    });
});

describe('Plans API', () => {
    it('lists available plans without auth', async () => {
        const res = await request(app).get('/api/v1/plans');
        expect(res.status).toBe(200);
        const plans = res.body.data.plans;
        expect(plans).toHaveLength(2);
        expect(plans.map((p) => p.id)).toEqual(['free', 'pro']);
        expect(plans.find((p) => p.id === 'pro').priceMonthly).toBe(19900);
    });

    it('owner submits an upgrade request (v1 logs intent)', async () => {
        const data = await registerBusiness('J');
        const res = await request(app)
            .post('/api/v1/business/upgrade-request')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ plan: 'pro' });
        expect(res.status).toBe(202);
        expect(res.body.data.request.plan).toBe('pro');
        expect(res.body.data.request.status).toBe('pending');
    });

    it('staff cannot request an upgrade', async () => {
        const data = await registerBusiness('K');
        await createStaff(data.accessToken, 'Helper', 'helper4@test.com');
        const login = await loginStaff('helper4@test.com');
        const res = await request(app)
            .post('/api/v1/business/upgrade-request')
            .set('Authorization', `Bearer ${login.body.data.accessToken}`)
            .send({ plan: 'pro' });
        expect(res.status).toBe(403);
    });
});
