const request = require('supertest');
const app = require('../src/app');
const Business = require('../src/models/Business');
const User = require('../src/models/User');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
  const res = await request(app).post('/api/v1/auth/register').send({
    businessName: `Business ${suffix}`,
    name: `Owner ${suffix}`,
    email: `owner${suffix}@test.com`,
    password: 'secret123',
  });
  return res.body.data;
};

const createStaffFor = async (businessData, suffix) => {
  return User.create({
    name: `Staff ${suffix}`,
    email: `staff${suffix}@test.com`,
    password: 'secret123',
    role: 'staff',
    businessId: businessData.business.id,
  });
};

describe('GET /api/v1/business', () => {
  it('returns the caller own business', async () => {
    const data = await registerBusiness('A');
    const res = await request(app)
      .get('/api/v1/business')
      .set('Authorization', `Bearer ${data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.business.name).toBe('Business A');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/business');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/business', () => {
  it('owner can update business fields', async () => {
    const data = await registerBusiness('B');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${data.accessToken}`)
      .send({ name: 'Renamed Biz', gstin: '27ABCDE1234F1Z5', address: 'MG Road, Pune' });
    expect(res.status).toBe(200);
    expect(res.body.data.business.name).toBe('Renamed Biz');
    expect(res.body.data.business.gstin).toBe('27ABCDE1234F1Z5');
  });

  it('staff gets 403', async () => {
    const data = await registerBusiness('C');
    const staff = await createStaffFor(data, 'C');
    const { generateAccessToken } = require('../src/utils/tokens');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${generateAccessToken(staff)}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid GSTIN length', async () => {
    const data = await registerBusiness('D');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${data.accessToken}`)
      .send({ gstin: 'TOOSHORT' });
    expect(res.status).toBe(400);
  });

  it('tenant isolation: business A update never touches business B', async () => {
    const dataA = await registerBusiness('E');
    const dataB = await registerBusiness('F');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${dataA.accessToken}`)
      .send({ name: 'A New Name' });
    expect(res.status).toBe(200);
    const bizB = await Business.findById(dataB.business.id);
    expect(bizB.name).toBe('Business F');
    const bizA = await Business.findById(dataA.business.id);
    expect(bizA.name).toBe('A New Name');
  });
});
