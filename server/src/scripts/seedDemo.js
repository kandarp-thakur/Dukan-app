/**
 * Demo data seeder.
 *
 * Provisions a business + owner account that a client can log into, plus enough
 * sample catalog / customers / sales to make the dashboard look alive.
 *
 * Re-runnable: if the demo business already exists its scoped data is reset, so
 * running twice leaves the same number of records (idempotent).
 *
 * Usage:
 *   npm run seed            # uses DEFAULTS below
 *   SEED_EMAIL=a@b.com SEED_PASSWORD=secret123 npm run seed
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const KhataEntry = require('../models/KhataEntry');
const Invoice = require('../models/Invoice');
const { recomputeBalance } = require('../controllers/customerController');

const DEFAULTS = {
    businessName: 'Demo Traders',
    name: 'Demo Owner',
    email: 'demo@dukan.app',
    password: 'Demo@12345',
};

const SAMPLE_PRODUCTS = [
    { name: 'Basmati Rice 5kg', sku: 'RICE-5', purchasePrice: 420, sellingPrice: 520, stockQty: 40, lowStockThreshold: 8 },
    { name: 'Sunflower Oil 1L', sku: 'OIL-1', purchasePrice: 118, sellingPrice: 145, stockQty: 60, lowStockThreshold: 10 },
    { name: 'Wheat Flour 10kg', sku: 'ATTA-10', purchasePrice: 380, sellingPrice: 460, stockQty: 25, lowStockThreshold: 6 },
    { name: 'Sugar 1kg', sku: 'SUGAR-1', purchasePrice: 42, sellingPrice: 52, stockQty: 90, lowStockThreshold: 15 },
    { name: 'Tea Powder 500g', sku: 'TEA-500', purchasePrice: 210, sellingPrice: 265, stockQty: 4, lowStockThreshold: 5 },
];

const SAMPLE_CUSTOMERS = [
    { name: 'Ramesh Kirana', phone: '9876543210', address: 'MG Road, Pune', email: 'ramesh@example.com' },
    { name: 'Sunita General Store', phone: '9812345678', address: 'FC Road, Pune', email: 'sunita@example.com' },
    { name: 'Walk-in Customer', phone: '', address: '' },
];

// Each sale references products by index into SAMPLE_PRODUCTS.
const SAMPLE_SALES = [
    { customerIndex: null, paymentMethod: 'cash', items: [{ productIndex: 0, qty: 2 }, { productIndex: 3, qty: 5 }] },
    { customerIndex: 0, paymentMethod: 'upi', items: [{ productIndex: 1, qty: 3 }] },
    { customerIndex: 1, paymentMethod: 'credit', items: [{ productIndex: 2, qty: 4 }, { productIndex: 4, qty: 2 }] },
];

async function seedDemo(options = {}) {
    const config = { ...DEFAULTS, ...options };

    // 1. Business (reuse if the demo business already exists).
    let business = await Business.findOne({ name: config.businessName });
    if (!business) {
        business = await Business.create({
            name: config.businessName,
            address: 'Shop 12, Market Yard, Pune',
            gstin: '27ABCDE1234F1Z5',
            invoicePrefix: 'DEMO',
            plan: 'pro',
        });
    } else {
        business.invoicePrefix = business.invoicePrefix || 'DEMO';
        business.invoiceCounter = 0;
        await business.save();
    }
    const businessId = business._id;

    // 2. Owner account (reuse + reset password so it is always loginable).
    let user = await User.findOne({ email: config.email });
    if (!user) {
        user = new User({ name: config.name, email: config.email, role: 'owner', businessId });
    }
    user.name = config.name;
    user.role = 'owner';
    user.businessId = businessId;
    user.password = config.password; // virtual setter → bcrypt hash
    await user.save();

    // 3. Reset this business's data so re-runs stay idempotent.
    await Promise.all([
        Product.deleteMany({ businessId }),
        Customer.deleteMany({ businessId }),
        Sale.deleteMany({ businessId }),
        KhataEntry.deleteMany({ businessId }),
        Invoice.deleteMany({ businessId }),
    ]);

    // 4. Catalog.
    const products = [];
    for (const p of SAMPLE_PRODUCTS) {
        products.push(await Product.create({ businessId, ...p }));
    }

    // 5. Customers.
    const customers = [];
    for (const c of SAMPLE_CUSTOMERS) {
        customers.push(await Customer.create({ businessId, ...c }));
    }

    // 6. Sales (with invoice numbers + stock decrement + khata for credit sales).
    let counter = 0;
    for (const s of SAMPLE_SALES) {
        const items = s.items.map(({ productIndex, qty }) => {
            const product = products[productIndex];
            return {
                productId: product._id,
                name: product.name,
                qty,
                rate: product.sellingPrice,
                gstRate: 0,
                hsn: '',
            };
        });

        const customer = s.customerIndex === null ? null : customers[s.customerIndex];
        counter += 1;
        const invoiceNumber = `${business.invoicePrefix}-${counter}`;

        const sale = await Sale.create({
            businessId,
            items,
            paymentMethod: s.paymentMethod,
            customerId: customer ? customer._id : null,
            buyerName: customer ? customer.name : '',
            invoiceNumber,
        });

        for (const item of items) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stockQty: -item.qty } });
        }

        if (s.paymentMethod === 'credit' && customer) {
            await KhataEntry.create({
                businessId,
                customerId: customer._id,
                type: 'credit',
                amount: sale.total,
                saleId: sale._id,
                note: `Sale ${invoiceNumber}`,
            });
            await recomputeBalance(businessId, customer._id);
        }

        await Invoice.create({ businessId, saleId: sale._id, invoiceNumber });
    }

    business.invoiceCounter = counter;
    await business.save();

    return {
        businessId,
        userId: user._id,
        credentials: {
            email: config.email,
            password: config.password,
            businessName: config.businessName,
        },
    };
}

// CLI entrypoint: only runs when invoked directly (`node src/scripts/seedDemo.js`).
if (require.main === module) {
    require('dotenv').config();
    const { connectDB } = require('../config/db');

    (async () => {
        try {
            await connectDB();
            const config = {
                businessName: process.env.SEED_BUSINESS_NAME || DEFAULTS.businessName,
                name: process.env.SEED_NAME || DEFAULTS.name,
                email: process.env.SEED_EMAIL || DEFAULTS.email,
                password: process.env.SEED_PASSWORD || DEFAULTS.password,
            };
            const { credentials } = await seedDemo(config);
            console.log('\nDemo account ready. Log in with:');
            console.log(`  Email:    ${credentials.email}`);
            console.log(`  Password: ${credentials.password}`);
            console.log(`  Business: ${credentials.businessName}\n`);
        } catch (err) {
            console.error('Seed failed:', err.message);
            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    })();
}

module.exports = { seedDemo, DEFAULTS };
