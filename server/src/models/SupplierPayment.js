const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema(
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
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be positive'],
        },
        method: {
            type: String,
            enum: ['cash', 'upi', 'card'],
            required: [true, 'Method is required'],
        },
        note: { type: String, default: '' },
        date: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

supplierPaymentSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
