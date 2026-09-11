const mongoose = require('mongoose');

const khataEntrySchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: [true, 'businessId is required'],
            index: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['credit', 'payment'],
            required: [true, 'Type must be credit or payment'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be positive'],
        },
        saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
        note: { type: String, default: '' },
        date: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

khataEntrySchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('KhataEntry', khataEntrySchema);
