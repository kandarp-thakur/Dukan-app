const { setupTestDB } = require('./setupTestDB');
const { seedDemo } = require('../src/scripts/seedDemo');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const Product = require('../src/models/Product');
const Customer = require('../src/models/Customer');
const Sale = require('../src/models/Sale');

setupTestDB();

const DEMO = {
    email: 'demo@dukan.app',
    password: 'Demo@12345',
    businessName: 'Demo Traders',
    name: 'Demo Owner',
};

describe('seedDemo', () => {
    it('creates a loginable owner account bound to a business', async () => {
        const result = await seedDemo(DEMO);

        expect(result.credentials.email).toBe('demo@dukan.app');
        expect(result.credentials.password).toBe('Demo@12345');

        const user = await User.findOne({ email: DEMO.email });
        expect(user).not.toBeNull();
        expect(user.role).toBe('owner');
        expect(user.comparePassword(DEMO.password)).toBe(true);
        // Password must be stored hashed, never in plaintext.
        expect(user.passwordHash).not.toBe(DEMO.password);

        const business = await Business.findById(user.businessId);
        expect(business.name).toBe(DEMO.businessName);
    });

    it('provisions sample products, customers and sales scoped to the demo business', async () => {
        const { businessId } = await seedDemo(DEMO);

        const products = await Product.find({ businessId });
        const customers = await Customer.find({ businessId });
        const sales = await Sale.find({ businessId });

        expect(products.length).toBeGreaterThan(0);
        expect(customers.length).toBeGreaterThan(0);
        expect(sales.length).toBeGreaterThan(0);

        // Every sale must reference only this business's products and carry a total.
        const productIds = products.map((p) => p._id.toString());
        for (const sale of sales) {
            expect(sale.total).toBeGreaterThan(0);
            for (const item of sale.items) {
                expect(productIds).toContain(item.productId.toString());
            }
        }
    });

    it('is idempotent: re-running does not duplicate the demo data', async () => {
        await seedDemo(DEMO);
        const firstProducts = await Product.countDocuments({});
        const firstCustomers = await Customer.countDocuments({});
        const firstSales = await Sale.countDocuments({});

        await seedDemo(DEMO);

        expect(await User.countDocuments({ email: DEMO.email })).toBe(1);
        expect(await Business.countDocuments({ name: DEMO.businessName })).toBe(1);
        expect(await Product.countDocuments({})).toBe(firstProducts);
        expect(await Customer.countDocuments({})).toBe(firstCustomers);
        expect(await Sale.countDocuments({})).toBe(firstSales);
    });
});
