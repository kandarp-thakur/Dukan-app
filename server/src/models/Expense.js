const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: [true, 'businessId is required'],
            index: true,
        },
        category: {
            type: String,
            enum: ['rent', 'salary', 'stock', 'transport', 'electricity', 'other'],
            required: [true, 'Category is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be positive'],
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'upi', 'card'],
            required: [true, 'Payment method is required'],
        },
        note: { type: String, default: '' },
        date: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

expenseSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Expense', expenseSchema);
