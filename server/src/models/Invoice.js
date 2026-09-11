const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: [true, 'businessId is required'],
            index: true,
        },
        saleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Sale',
            required: true,
            index: true,
        },
        invoiceNumber: { type: String, required: [true, 'Invoice number is required'] },
        pdfUrl: { type: String, default: '' },
    },
    { timestamps: true }
);

invoiceSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Invoice', invoiceSchema);
