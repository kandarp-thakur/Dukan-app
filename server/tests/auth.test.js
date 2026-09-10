const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerPayload = {
  businessName: 'Shubham Traders',
  name: 'Shubham',
  email: 'shubham@test.com',
  password: 'secret123',
};

describe('POST /api/v1/auth/register', () => {
  it('creates user + business and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('shubham@test.com');
    expect(res.body.data.user.role).toBe('owner');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.business.name).toBe('Shubham Traders');
    expect(res.body.data.business.plan).toBe('free');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('refreshToken=');
    expect(cookie).toContain('HttpOnly');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload, businessName: 'Other Biz', name: 'Other' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@test.com', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['Business name is required', 'Name is required'])
    );
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Password must be at least 8 characters');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 401 for wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'shubham@test.com', password: 'wrongpass1' });
    expect(res.status).toBe(401);
  });

  it('returns tokens and user for valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'shubham@test.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('shubham@test.com');
    expect(res.body.data.business.name).toBe('Shubham Traders');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns a new access token for a valid cookie', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const cookie = reg.headers['set-cookie'][0];
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('clears the refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toContain('refreshToken=;');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns user and business for a valid access token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const token = reg.body.data.accessToken;
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('shubham@test.com');
    expect(res.body.data.business.name).toBe('Shubham Traders');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
