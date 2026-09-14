const Sale = require('../models/Sale');
const Business = require('../models/Business');
const {
    generateShareToken,
    shareTokenExpiry,
    isTokenExpired,
    shareUrlFor,
} = require('../utils/shareToken');
const { sendInvoiceEmail } = require('../services/emailService');
const { invoiceEmailHtml } = require('../services/emailTemplates');

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

const PUBLIC_INVOICE_FIELDS =
    'invoiceNumber date items subtotal discount tax isGst cgst sgst igst ' +
    'buyerName buyerAddress buyerGstin placeOfSupply total status';

exports.sendInvoiceEmail = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'A PDF attachment is required' });
    }

    const business = await Business.findById(req.businessId);
    const businessName = (business && business.name) || 'our store';
    const link = sale.shareToken ? shareUrlFor(sale.shareToken) : '';

    try {
        await sendInvoiceEmail({
            to: req.body.to,
            subject: req.body.subject || `Invoice ${sale.invoiceNumber} from ${businessName}`,
            html: invoiceEmailHtml({ business: business && business.toJSON(), invoice: sale, link }),
            pdf: req.file.buffer,
            fileName: `${sale.invoiceNumber || 'invoice'}.pdf`,
        });
    } catch (err) {
        return res
            .status(err.status || 502)
            .json({ success: false, message: err.message || 'Could not send email' });
    }

    return res.json({ success: true, message: 'Invoice emailed', data: null });
};

exports.createShareLink = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Every call rotates: a previously leaked link stops working.
    sale.shareToken = generateShareToken();
    sale.shareTokenExpiresAt = shareTokenExpiry();
    await sale.save();

    return res.json({
        success: true,
        message: 'Share link created',
        data: {
            shareToken: sale.shareToken,
            shareUrl: shareUrlFor(sale.shareToken),
            expiresAt: sale.shareTokenExpiresAt,
        },
    });
};

exports.revokeShareLink = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    sale.shareToken = '';
    sale.shareTokenExpiresAt = null;
    await sale.save();

    return res.json({ success: true, message: 'Share link revoked', data: null });
};

// The token is the authorization. No authenticate, no tenantScope.
exports.getPublicInvoice = async (req, res) => {
    const token = req.params.token;
    const notFound = { success: false, message: 'This invoice link is no longer available' };
    if (!token) return res.status(404).json(notFound);

    const sale = await Sale.findOne({ shareToken: token }).select(
        `${PUBLIC_INVOICE_FIELDS} businessId shareToken shareTokenExpiresAt`
    );
    if (!sale || !sale.shareToken || isTokenExpired(sale)) {
        return res.status(404).json(notFound);
    }

    const business = await Business.findById(sale.businessId);
    const invoice = {
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        items: sale.items.map((it) => ({
            name: it.name,
            qty: it.qty,
            rate: it.rate,
            amount: it.amount,
            gstRate: it.gstRate,
            hsn: it.hsn,
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        isGst: sale.isGst,
        cgst: sale.cgst,
        sgst: sale.sgst,
        igst: sale.igst,
        buyerName: sale.buyerName,
        buyerAddress: sale.buyerAddress,
        buyerGstin: sale.buyerGstin,
        placeOfSupply: sale.placeOfSupply,
        total: sale.total,
        status: sale.status,
    };

    return res.json({
        success: true,
        message: 'OK',
        data: {
            invoice,
            business: business
                ? { name: business.name, address: business.address, gstin: business.gstin }
                : null,
        },
    });
};
