const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const KhataEntry = require('../models/KhataEntry');

const recomputeBalance = async (businessId, customerId) => {
    const [agg] = await KhataEntry.aggregate([
        {
            $match: {
                businessId: new mongoose.Types.ObjectId(businessId),
                customerId: new mongoose.Types.ObjectId(customerId),
            },
        },
        {
            $group: {
                _id: null,
                credits: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
                payments: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } },
            },
        },
    ]);
    const balance = agg ? agg.credits - agg.payments : 0;
    await Customer.findByIdAndUpdate(customerId, { balance });
    return balance;
};

exports.listCustomers = async (req, res) => {
    const customers = await Customer.find({ businessId: req.businessId }).sort({ name: 1 });
    return res.json({ success: true, message: 'OK', data: { customers } });
};

exports.createCustomer = async (req, res) => {
    const { name, phone, gstin, address } = req.body;
    const customer = await Customer.create({
        businessId: req.businessId,
        name,
        phone: phone || '',
        gstin: gstin || '',
        address: address || '',
    });
    return res.status(201).json({ success: true, message: 'Customer created', data: { customer } });
};

exports.updateCustomer = async (req, res) => {
    const allowed = ['name', 'phone', 'gstin', 'address'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    }
    const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, businessId: req.businessId },
        updates,
        { new: true, runValidators: true }
    );
    if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, message: 'Customer updated', data: { customer } });
};

exports.deleteCustomer = async (req, res) => {
    const customer = await Customer.findOneAndDelete({
        _id: req.params.id,
        businessId: req.businessId,
    });
    if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    await KhataEntry.deleteMany({ businessId: req.businessId, customerId: req.params.id });
    return res.json({ success: true, message: 'Customer deleted', data: null });
};

exports.getKhata = async (req, res) => {
    const customer = await Customer.findOne({
        _id: req.params.id,
        businessId: req.businessId,
    });
    if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const entries = await KhataEntry.find({
        businessId: req.businessId,
        customerId: req.params.id,
    }).sort({ date: 1, createdAt: 1 });
    // Compute the balance live from the entries so the statement is always accurate,
    // even if entries were written by another flow (e.g. credit sale creation).
    const balance = await recomputeBalance(req.businessId, customer._id);
    return res.json({
        success: true,
        message: 'OK',
        data: { customer, entries, balance },
    });
};

exports.recordPayment = async (req, res) => {
    const { customerId, amount, note } = req.body;
    const customer = await Customer.findOne({
        _id: customerId,
        businessId: req.businessId,
    });
    if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const entry = await KhataEntry.create({
        businessId: req.businessId,
        customerId,
        type: 'payment',
        amount,
        note: note || '',
    });
    const balance = await recomputeBalance(req.businessId, customer._id);
    return res.status(201).json({
        success: true,
        message: 'Payment recorded',
        data: { entry, balance },
    });
};

exports.recomputeBalance = recomputeBalance;
