const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: [true, 'businessId is required'],
            index: true,
        },
        name: { type: String, required: [true, 'Customer name is required'], trim: true },
        phone: { type: String, default: '' },
        balance: { type: Number, default: 0 },
    },
    { timestamps: true }
);

customerSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Customer', customerSchema);
