const Sale = require('../models/Sale');
const Business = require('../models/Business');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.listInvoices = async (req, res) => {
    const { q, type, from, to } = req.query;

    if (from && to && new Date(to) < new Date(from)) {
        return res.status(400).json({ success: false, message: "'to' must be after 'from'" });
    }

    const filter = { businessId: req.businessId, invoiceNumber: { $ne: '' } };
    if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ invoiceNumber: rx }, { buyerName: rx }];
    }
    if (type === 'gst') filter.isGst = true;
    else if (type === 'non-gst') filter.isGst = false;
    if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
    }

    const sales = await Sale.find(filter).sort({ date: -1, createdAt: -1 });
    const invoices = sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        date: s.date,
        buyerName: s.buyerName,
        total: s.total,
        isGst: s.isGst,
        status: s.status,
    }));
    return res.json({ success: true, message: 'OK', data: { invoices } });
};

exports.getInvoice = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const business = await Business.findById(req.businessId);
    const snapshot = business
        ? { name: business.name, address: business.address, gstin: business.gstin }
        : null;
    return res.json({
        success: true,
        message: 'OK',
        data: { invoice: sale.toJSON(), business: snapshot },
    });
};
