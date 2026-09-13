const mongoose = require('mongoose');
const Business = require('../src/models/Business');
const Product = require('../src/models/Product');
const Customer = require('../src/models/Customer');
const Supplier = require('../src/models/Supplier');
const KhataEntry = require('../src/models/KhataEntry');
const Expense = require('../src/models/Expense');
const Purchase = require('../src/models/Purchase');
const SupplierPayment = require('../src/models/SupplierPayment');
const Sale = require('../src/models/Sale');
const Invoice = require('../src/models/Invoice');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

let business;

beforeEach(async () => {
    business = await Business.create({ name: 'Feature Shop' });
});

describe('Product model', () => {
    it('creates with defaults and computes lowStock', async () => {
        const product = await Product.create({
            businessId: business._id,
            name: 'Rice 1kg',
            purchasePrice: 4000,
            sellingPrice: 5500,
            stockQty: 3,
            lowStockThreshold: 5,
        });
        expect(product.sku).toBe('');
        expect(product.lowStock).toBe(true);
        const stocked = await Product.create({
            businessId: business._id,
            name: 'Dal 1kg',
            purchasePrice: 8000,
            sellingPrice: 10000,
            stockQty: 50,
            lowStockThreshold: 5,
        });
        expect(stocked.lowStock).toBe(false);
    });

    it('requires businessId, name and prices', async () => {
        await expect(Product.create({ name: 'X' })).rejects.toThrow(mongoose.Error.ValidationError);
        await expect(Product.create({ businessId: business._id, name: 'X' })).rejects.toThrow(
            mongoose.Error.ValidationError
        );
    });
});

describe('Customer model', () => {
    it('creates with defaults and hides nothing sensitive', async () => {
        const customer = await Customer.create({
            businessId: business._id,
            name: 'Ramesh',
            phone: '9876543210',
        });
        expect(customer.balance).toBe(0);
        const json = customer.toJSON();
        expect(json.id).toBe(customer._id.toString());
        expect(json.name).toBe('Ramesh');
    });

    it('requires businessId and name', async () => {
        await expect(Customer.create({ name: 'No Biz' })).rejects.toThrow(
            mongoose.Error.ValidationError
        );
    });
});

describe('Supplier model', () => {
    it('creates with zero default balance', async () => {
        const supplier = await Supplier.create({
            businessId: business._id,
            name: 'Wholesale Mart',
            phone: '9123456780',
        });
        expect(supplier.balance).toBe(0);
    });
});

describe('KhataEntry model', () => {
    it('accepts credit and payment types and links a sale', async () => {
        const customer = await Customer.create({ businessId: business._id, name: 'Ramesh' });
        const entry = await KhataEntry.create({
            businessId: business._id,
            customerId: customer._id,
            type: 'credit',
            amount: 25000,
            note: 'credit sale',
        });
        expect(entry.date).toBeTruthy();
        const payment = await KhataEntry.create({
            businessId: business._id,
            customerId: customer._id,
            type: 'payment',
            amount: 5000,
        });
        expect(payment.type).toBe('payment');
    });

    it('rejects invalid type and non-positive amount', async () => {
        const customer = await Customer.create({ businessId: business._id, name: 'Ramesh' });
        await expect(
            KhataEntry.create({ businessId: business._id, customerId: customer._id, type: 'refund', amount: 100 })
        ).rejects.toThrow(mongoose.Error.ValidationError);
        await expect(
            KhataEntry.create({ businessId: business._id, customerId: customer._id, type: 'credit', amount: 0 })
        ).rejects.toThrow(mongoose.Error.ValidationError);
    });
});

describe('Expense model', () => {
    it('creates with category, method, date default', async () => {
        const expense = await Expense.create({
            businessId: business._id,
            category: 'rent',
            amount: 1500000,
            paymentMethod: 'cash',
            note: 'shop rent',
        });
        expect(expense.date).toBeTruthy();
        expect(expense.note).toBe('shop rent');
    });

    it('rejects unknown category and non-positive amount', async () => {
        await expect(
            Expense.create({ businessId: business._id, category: 'party', amount: 100, paymentMethod: 'cash' })
        ).rejects.toThrow(mongoose.Error.ValidationError);
        await expect(
            Expense.create({ businessId: business._id, category: 'rent', amount: -5, paymentMethod: 'cash' })
        ).rejects.toThrow(mongoose.Error.ValidationError);
    });
});

describe('Purchase model', () => {
    it('computes total from items when omitted and defaults status', async () => {
        const supplier = await Supplier.create({ businessId: business._id, name: 'Wholesale Mart' });
        const product = await Product.create({
            businessId: business._id,
            name: 'Rice 1kg',
            purchasePrice: 4000,
            sellingPrice: 5500,
        });
        const purchase = await Purchase.create({
            businessId: business._id,
            supplierId: supplier._id,
            items: [
                { productId: product._id, name: 'Rice 1kg', qty: 10, cost: 4000 },
                { productId: product._id, name: 'Rice 1kg', qty: 5, cost: 4200 },
            ],
            paymentMethod: 'credit',
        });
        expect(purchase.total).toBe(10 * 4000 + 5 * 4200);
        expect(purchase.status).toBe('completed');
        expect(purchase.date).toBeTruthy();
    });

    it('rejects invalid paymentMethod', async () => {
        const supplier = await Supplier.create({ businessId: business._id, name: 'W' });
        await expect(
            Purchase.create({
                businessId: business._id,
                supplierId: supplier._id,
                items: [{ name: 'X', qty: 1, cost: 100 }],
                paymentMethod: 'gold',
            })
        ).rejects.toThrow(mongoose.Error.ValidationError);
    });
});

describe('SupplierPayment model', () => {
    it('creates with method and date default', async () => {
        const supplier = await Supplier.create({ businessId: business._id, name: 'W' });
        const payment = await SupplierPayment.create({
            businessId: business._id,
            supplierId: supplier._id,
            amount: 25000,
            method: 'upi',
            note: 'part payment',
        });
        expect(payment.date).toBeTruthy();
    });
});

describe('Sale model', () => {
    it('computes total from items + discount + tax and defaults invoice fields', async () => {
        const product = await Product.create({
            businessId: business._id,
            name: 'Rice 1kg',
            purchasePrice: 4000,
            sellingPrice: 5500,
        });
        const sale = await Sale.create({
            businessId: business._id,
            items: [{ productId: product._id, name: 'Rice 1kg', qty: 2, rate: 5500 }],
            paymentMethod: 'cash',
        });
        expect(sale.total).toBe(11000);
        expect(sale.subtotal).toBe(11000);
        expect(sale.discount).toBe(0);
        expect(sale.tax).toBe(0);
        expect(sale.status).toBe('completed');
        expect(sale.date).toBeTruthy();
        const withDiscount = await Sale.create({
            businessId: business._id,
            items: [{ name: 'X', qty: 1, rate: 10000 }],
            discount: 500,
            tax: 200,
            paymentMethod: 'upi',
        });
        expect(withDiscount.total).toBe(10000 - 500 + 200);
    });

    it('requires customerId for credit sales (controller-level rule is enforced by API; model allows but validates method)', async () => {
        await expect(
            Sale.create({
                businessId: business._id,
                items: [{ name: 'X', qty: 1, rate: 100 }],
                paymentMethod: 'bitcoin',
            })
        ).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('defaults GST fields for a non-GST sale', async () => {
        const sale = await Sale.create({
            businessId: business._id,
            items: [{ name: 'Pen', qty: 2, rate: 1000 }],
            paymentMethod: 'cash',
        });
        expect(sale.isGst).toBe(false);
        expect(sale.cgst).toBe(0);
        expect(sale.sgst).toBe(0);
        expect(sale.igst).toBe(0);
        expect(sale.buyerName).toBe('');
        expect(sale.buyerGstin).toBe('');
        expect(sale.buyerAddress).toBe('');
        expect(sale.placeOfSupply).toBe('');
        expect(sale.items[0].gstRate).toBe(0);
        expect(sale.items[0].hsn).toBe('');
        expect(sale.total).toBe(2000);
    });

    it('persists GST fields when provided', async () => {
        const sale = await Sale.create({
            businessId: business._id,
            items: [{ name: 'Rice', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
            discount: 0,
            tax: 1980,
            cgst: 990,
            sgst: 990,
            igst: 0,
            isGst: true,
            buyerName: 'Ramesh',
            buyerGstin: '27XYZAB5678C1Z9',
            buyerAddress: 'MG Road, Pune',
            placeOfSupply: 'MH',
            paymentMethod: 'cash',
        });
        expect(sale.isGst).toBe(true);
        expect(sale.cgst).toBe(990);
        expect(sale.sgst).toBe(990);
        expect(sale.total).toBe(11000 + 1980);
        expect(sale.items[0].gstRate).toBe(18);
        expect(sale.items[0].hsn).toBe('1006');
    });
});

describe('Invoice model', () => {
    it('creates linked to a sale with a unique-ish invoice number', async () => {
        const sale = await Sale.create({
            businessId: business._id,
            items: [{ name: 'X', qty: 1, rate: 100 }],
            paymentMethod: 'cash',
        });
        const invoice = await Invoice.create({
            businessId: business._id,
            saleId: sale._id,
            invoiceNumber: 'INV-1',
        });
        expect(invoice.pdfUrl).toBe('');
        const json = invoice.toJSON();
        expect(json.id).toBe(invoice._id.toString());
    });
});
