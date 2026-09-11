const Product = require('../models/Product');

exports.listProducts = async (req, res) => {
    const products = await Product.find({ businessId: req.businessId }).sort({ name: 1 });
    return res.json({ success: true, message: 'OK', data: { products } });
};

exports.createProduct = async (req, res) => {
    const { name, sku, purchasePrice, sellingPrice, stockQty, lowStockThreshold } = req.body;
    const product = await Product.create({
        businessId: req.businessId,
        name,
        sku: sku || '',
        purchasePrice,
        sellingPrice,
        stockQty: stockQty || 0,
        lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : 5,
    });
    return res.status(201).json({
        success: true,
        message: 'Product created',
        data: { product },
    });
};

exports.updateProduct = async (req, res) => {
    const allowed = ['name', 'sku', 'purchasePrice', 'sellingPrice', 'stockQty', 'lowStockThreshold'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    }
    const product = await Product.findOneAndUpdate(
        { _id: req.params.id, businessId: req.businessId },
        updates,
        { new: true, runValidators: true }
    );
    if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product updated', data: { product } });
};

exports.deleteProduct = async (req, res) => {
    const product = await Product.findOneAndDelete({
        _id: req.params.id,
        businessId: req.businessId,
    });
    if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product deleted', data: null });
};

exports.lowStock = async (req, res) => {
    // Per-product threshold comparison: filter in memory (safe, small lists in v1).
    const all = await Product.find({ businessId: req.businessId }).sort({ stockQty: 1 });
    const low = all.filter((p) => p.stockQty <= p.lowStockThreshold);
    return res.json({ success: true, message: 'OK', data: { products: low } });
};
