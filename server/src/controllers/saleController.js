const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const KhataEntry = require('../models/KhataEntry');
const Business = require('../models/Business');
const Invoice = require('../models/Invoice');
const { recomputeBalance } = require('./customerController');

exports.listSales = async (req, res) => {
    const sales = await Sale.find({ businessId: req.businessId }).sort({ date: -1, createdAt: -1 });
    return res.json({ success: true, message: 'OK', data: { sales } });
};

exports.getSale = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    return res.json({ success: true, message: 'OK', data: { sale } });
};

exports.createSale = async (req, res) => {
    const { items, discount, tax, paymentMethod, customerId, date } = req.body;

    if (paymentMethod === 'credit' && !customerId) {
        return res
            .status(400)
            .json({ success: false, message: 'Credit sales require a customer (khata)' });
    }

    if (customerId) {
        const customer = await Customer.findOne({ _id: customerId, businessId: req.businessId });
        if (!customer) {
            return res.status(400).json({ success: false, message: 'Customer not found' });
        }
    }

    // Validate stock for all catalog items before writing anything.
    const productItems = items.filter((item) => item.productId);
    for (const item of productItems) {
        const product = await Product.findOne({
            _id: item.productId,
            businessId: req.businessId,
        });
        if (!product) {
            return res.status(400).json({ success: false, message: `Product not found: ${item.name}` });
        }
        if (product.stockQty < item.qty) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock for ${product.name}: ${product.stockQty} available, ${item.qty} requested`,
            });
        }
    }

    // Atomic per-business invoice numbering.
    const business = await Business.findByIdAndUpdate(
        req.businessId,
        { $inc: { invoiceCounter: 1 } },
        { new: true }
    );
    const invoiceNumber = `${business.invoicePrefix}-${business.invoiceCounter}`;

    const sale = await Sale.create({
        businessId: req.businessId,
        items,
        discount: discount || 0,
        tax: tax || 0,
        paymentMethod,
        customerId: customerId || null,
        invoiceNumber,
        date: date || undefined,
    });

    // Decrement stock for catalog items.
    for (const item of productItems) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stockQty: -item.qty } });
    }

    // Credit sale: record the receivable in khata.
    if (paymentMethod === 'credit' && customerId) {
        await KhataEntry.create({
            businessId: req.businessId,
            customerId,
            type: 'credit',
            amount: sale.total,
            saleId: sale._id,
            note: `Sale ${invoiceNumber}`,
        });
        await recomputeBalance(req.businessId, customerId);
    }

    await Invoice.create({
        businessId: req.businessId,
        saleId: sale._id,
        invoiceNumber,
    });

    return res.status(201).json({
        success: true,
        message: 'Sale created',
        data: { sale },
    });
};

exports.cancelSale = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    if (sale.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'Sale is already cancelled' });
    }

    sale.status = 'cancelled';
    await sale.save();

    // Restore stock for catalog items.
    for (const item of sale.items) {
        if (item.productId) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stockQty: item.qty } });
        }
    }

    // Reverse any khata credit created by this sale.
    await KhataEntry.findOneAndDelete({ businessId: req.businessId, saleId: sale._id, type: 'credit' });
    if (sale.customerId) {
        await recomputeBalance(req.businessId, sale.customerId);
    }

    return res.json({ success: true, message: 'Sale cancelled', data: { sale } });
};

exports.deleteSale = async (req, res) => {
    const sale = await Sale.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    await Invoice.findOneAndDelete({ saleId: sale._id, businessId: req.businessId });
    return res.json({ success: true, message: 'Sale deleted', data: null });
};
