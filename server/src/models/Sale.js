const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
        name: { type: String, required: [true, 'Item name is required'], trim: true },
        qty: { type: Number, required: true, min: [1, 'Qty must be at least 1'] },
        rate: { type: Number, required: true, min: [0, 'Rate cannot be negative'] },
        amount: { type: Number, min: 0 },
        gstRate: { type: Number, enum: [0, 5, 12, 18, 28], default: 0 },
        hsn: { type: String, default: '' },
    },
    { _id: false }
);

const saleSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: [true, 'businessId is required'],
            index: true,
        },
        items: { type: [saleItemSchema], required: true },
        subtotal: { type: Number, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        isGst: { type: Boolean, default: false },
        cgst: { type: Number, default: 0, min: 0 },
        sgst: { type: Number, default: 0, min: 0 },
        igst: { type: Number, default: 0, min: 0 },
        buyerGstin: { type: String, default: '' },
        buyerName: { type: String, default: '' },
        buyerAddress: { type: String, default: '' },
        placeOfSupply: { type: String, default: '' },
        total: { type: Number, min: 0 },
        paymentMethod: {
            type: String,
            enum: ['cash', 'upi', 'card', 'credit'],
            required: [true, 'Payment method is required'],
        },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
        invoiceNumber: { type: String, default: '' },
        status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
        date: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

saleSchema.pre('validate', function computeTotals(next) {
    if (this.items && this.items.length) {
        this.items.forEach((item) => {
            item.amount = item.qty * item.rate;
        });
        this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
        this.total = this.subtotal - (this.discount || 0) + (this.tax || 0);
    }
    next();
});

saleSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Sale', saleSchema);
