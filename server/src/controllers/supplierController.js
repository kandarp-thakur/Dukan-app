const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');

const recomputeSupplierBalance = async (businessId, supplierId) => {
    const [purchaseAgg] = await Purchase.aggregate([
        {
            $match: {
                businessId: new mongoose.Types.ObjectId(businessId),
                supplierId: new mongoose.Types.ObjectId(supplierId),
                status: 'completed',
                paymentMethod: 'credit',
            },
        },
        { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const [paymentAgg] = await SupplierPayment.aggregate([
        {
            $match: {
                businessId: new mongoose.Types.ObjectId(businessId),
                supplierId: new mongoose.Types.ObjectId(supplierId),
            },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const balance = (purchaseAgg ? purchaseAgg.total : 0) - (paymentAgg ? paymentAgg.total : 0);
    await Supplier.findByIdAndUpdate(supplierId, { balance });
    return balance;
};

exports.listSuppliers = async (req, res) => {
    const suppliers = await Supplier.find({ businessId: req.businessId }).sort({ name: 1 });
    return res.json({ success: true, message: 'OK', data: { suppliers } });
};

exports.createSupplier = async (req, res) => {
    const { name, phone } = req.body;
    const supplier = await Supplier.create({
        businessId: req.businessId,
        name,
        phone: phone || '',
    });
    return res.status(201).json({ success: true, message: 'Supplier created', data: { supplier } });
};

exports.updateSupplier = async (req, res) => {
    const allowed = ['name', 'phone'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    }
    const supplier = await Supplier.findOneAndUpdate(
        { _id: req.params.id, businessId: req.businessId },
        updates,
        { new: true, runValidators: true }
    );
    if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    return res.json({ success: true, message: 'Supplier updated', data: { supplier } });
};

exports.deleteSupplier = async (req, res) => {
    const supplier = await Supplier.findOneAndDelete({
        _id: req.params.id,
        businessId: req.businessId,
    });
    if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    return res.json({ success: true, message: 'Supplier deleted', data: null });
};

exports.getStatement = async (req, res) => {
    const supplier = await Supplier.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    const purchases = await Purchase.find({
        businessId: req.businessId,
        supplierId: req.params.id,
        status: 'completed',
    }).sort({ date: 1, createdAt: 1 });
    const payments = await SupplierPayment.find({
        businessId: req.businessId,
        supplierId: req.params.id,
    }).sort({ date: 1, createdAt: 1 });
    const balance = await recomputeSupplierBalance(req.businessId, supplier._id);
    return res.json({
        success: true,
        message: 'OK',
        data: { supplier, purchases, payments, balance },
    });
};

exports.createPurchase = async (req, res) => {
    const { supplierId, items, paymentMethod } = req.body;
    const supplier = await Supplier.findOne({ _id: supplierId, businessId: req.businessId });
    if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    const purchase = await Purchase.create({
        businessId: req.businessId,
        supplierId,
        items,
        paymentMethod,
    });
    // Increment product stock for items that reference products
    const Product = require('../models/Product');
    for (const item of items) {
        if (item.productId) {
            const product = await Product.findOne({
                _id: item.productId,
                businessId: req.businessId,
            });
            if (product) {
                await Product.findByIdAndUpdate(product._id, { $inc: { stockQty: item.qty } });
            }
        }
    }
    if (paymentMethod === 'credit') {
        await recomputeSupplierBalance(req.businessId, supplier._id);
    }
    const populated = await Purchase.findById(purchase._id).populate('supplierId', 'name');
    return res.status(201).json({
        success: true,
        message: 'Purchase recorded',
        data: {
            purchase: { ...populated.toJSON(), supplierName: populated.supplierId?.name || '' },
        },
    });
};

exports.listPurchases = async (req, res) => {
    const purchases = await Purchase.find({ businessId: req.businessId })
        .sort({ date: -1, createdAt: -1 })
        .populate('supplierId', 'name');
    return res.json({
        success: true,
        message: 'OK',
        data: {
            purchases: purchases.map((p) => ({ ...p.toJSON(), supplierName: p.supplierId?.name || '' })),
        },
    });
};

exports.recordSupplierPayment = async (req, res) => {
    const { supplierId, amount, method, note } = req.body;
    const supplier = await Supplier.findOne({ _id: supplierId, businessId: req.businessId });
    if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    const payment = await SupplierPayment.create({
        businessId: req.businessId,
        supplierId,
        amount,
        method,
        note: note || '',
    });
    const balance = await recomputeSupplierBalance(req.businessId, supplier._id);
    return res.status(201).json({
        success: true,
        message: 'Payment recorded',
        data: { payment, balance },
    });
};
