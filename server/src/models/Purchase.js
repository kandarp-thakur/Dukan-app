const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
        name: { type: String, required: [true, 'Item name is required'], trim: true },
        qty: { type: Number, required: true, min: [1, 'Qty must be at least 1'] },
        cost: { type: Number, required: true, min: [0, 'Cost cannot be negative'] },
    },
    { _id: false }
);

const purchaseSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: [true, 'businessId is required'],
            index: true,
        },
        supplierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: true,
            index: true,
        },
        items: { type: [purchaseItemSchema], required: true },
        total: { type: Number, min: 0 },
        paymentMethod: {
            type: String,
            enum: ['cash', 'upi', 'card', 'credit'],
            required: [true, 'Payment method is required'],
        },
        status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
        date: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

purchaseSchema.pre('validate', function computeTotal(next) {
    if (this.items && this.items.length) {
        this.total = this.items.reduce((sum, item) => sum + item.qty * item.cost, 0);
    }
    next();
});

purchaseSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Purchase', purchaseSchema);
