const request = require('supertest');
const app = require('../src/app');
const { errorHandler } = require('../src/middleware/errors');
const { validate } = require('../src/middleware/validate');

describe('notFound', () => {
  it('returns 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });
});

describe('errorHandler', () => {
  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('maps duplicate key error to 409', () => {
    const res = makeRes();
    errorHandler({ code: 11000, keyValue: { email: 'a@b.com' } }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it('maps mongoose ValidationError to 400 with messages', () => {
    const res = makeRes();
    const err = {
      name: 'ValidationError',
      errors: { email: { message: 'Email is required' }, name: { message: 'Name is required' } },
    };
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual(
      expect.arrayContaining(['Email is required', 'Name is required'])
    );
  });

  it('maps CastError to 400', () => {
    const res = makeRes();
    errorHandler({ name: 'CastError' }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps unknown errors to 500', () => {
    const res = makeRes();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('validate', () => {
  it('returns 400 with error messages when validation fails', async () => {
    const testApp = require('express')();
    testApp.use(require('express').json());
    const { body } = require('express-validator');
    testApp.post(
      '/t',
      body('email').isEmail().withMessage('Valid email is required'),
      validate,
      (req, res) => res.json({ success: true, message: 'OK', data: null })
    );
    const res = await request(testApp).post('/t').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Valid email is required']);
  });
});
