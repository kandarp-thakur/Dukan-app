const express = require('express');
require('express-async-errors');
const request = require('supertest');
const { authenticate, tenantScope, requireRole } = require('../src/middleware/auth');
const { generateAccessToken } = require('../src/utils/tokens');
const { errorHandler } = require('../src/middleware/errors');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const makeApp = () => {
  const app = express();
  app.get('/api/v1/whoami', authenticate, tenantScope, (req, res) =>
    res.json({
      success: true,
      message: 'OK',
      data: { userId: req.user.id, businessId: req.businessId, role: req.user.role },
    })
  );
  app.get('/api/v1/owner-only', authenticate, requireRole('owner'), (req, res) =>
    res.json({ success: true, message: 'OK', data: null })
  );
  app.use(errorHandler);
  return app;
};

const createUser = async (role) => {
  const business = await Business.create({ name: 'Test Biz' });
  return User.create({
    name: 'Test User',
    email: `${role}-${Date.now()}-${Math.random()}@test.com`,
    password: 'secret123',
    role,
    businessId: business._id,
  });
};

describe('authenticate', () => {
  it('returns 401 without authorization header', async () => {
    const res = await request(makeApp()).get('/api/v1/whoami');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with a garbage token', async () => {
    const res = await request(makeApp())
      .get('/api/v1/whoami')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns 500, not 401, when the user lookup fails', async () => {
    const user = await createUser('owner');
    const token = generateAccessToken(user);
    const findByIdSpy = jest.spyOn(User, 'findById').mockRejectedValue(new Error('db down'));
    const res = await request(makeApp())
      .get('/api/v1/whoami')
      .set('Authorization', `Bearer ${token}`);
    findByIdSpy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('sets req.user and req.businessId for a valid token', async () => {
    const user = await createUser('owner');
    const token = generateAccessToken(user);
    const res = await request(makeApp())
      .get('/api/v1/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user._id.toString());
    expect(res.body.data.businessId).toBe(user.businessId.toString());
    expect(res.body.data.role).toBe('owner');
  });
});

describe('requireRole', () => {
  it('returns 403 for staff on owner-only route', async () => {
    const staff = await createUser('staff');
    const res = await request(makeApp())
      .get('/api/v1/owner-only')
      .set('Authorization', `Bearer ${generateAccessToken(staff)}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 for owner on owner-only route', async () => {
    const owner = await createUser('owner');
    const res = await request(makeApp())
      .get('/api/v1/owner-only')
      .set('Authorization', `Bearer ${generateAccessToken(owner)}`);
    expect(res.status).toBe(200);
  });
});
