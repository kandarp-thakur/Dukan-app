const mongoose = require('mongoose');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

describe('User model', () => {
  it('hashes password via virtual and hides hash in toJSON', async () => {
    const business = await Business.create({ name: 'Test Shop' });
    const user = await User.create({
      name: 'Shubham',
      email: 'shubham@test.com',
      password: 'secret123',
      role: 'owner',
      businessId: business._id,
    });
    expect(user.passwordHash).not.toBe('secret123');
    expect(user.comparePassword('secret123')).toBe(true);
    expect(user.comparePassword('wrongpass')).toBe(false);
    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.email).toBe('shubham@test.com');
    expect(json.role).toBe('owner');
    expect(json.id).toBe(user._id.toString());
  });

  it('rejects duplicate email', async () => {
    const business = await Business.create({ name: 'Test Shop' });
    const userData = { password: 'secret123', businessId: business._id };
    await User.create({ ...userData, name: 'A', email: 'dup@test.com' });
    await expect(
      User.create({ ...userData, name: 'B', email: 'dup@test.com' })
    ).rejects.toThrow(/duplicate key|E11000/);
  });

  it('rejects invalid role', async () => {
    const business = await Business.create({ name: 'Test Shop' });
    await expect(
      User.create({
        name: 'A',
        email: 'role@test.com',
        password: 'secret123',
        role: 'admin',
        businessId: business._id,
      })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

describe('Business model', () => {
  it('applies v1 defaults', async () => {
    const business = await Business.create({ name: 'Kirana Store' });
    expect(business.currency).toBe('INR');
    expect(business.invoicePrefix).toBe('INV');
    expect(business.invoiceCounter).toBe(0);
    expect(business.plan).toBe('free');
    expect(business.planExpiresAt).toBeNull();
    const json = business.toJSON();
    expect(json.id).toBe(business._id.toString());
    expect(json._id).toBeUndefined();
  });

  it('rejects missing name', async () => {
    await expect(Business.create({})).rejects.toThrow(mongoose.Error.ValidationError);
  });
});
