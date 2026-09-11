const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
            index: true,
        },
        name: { type: String, required: [true, 'Product name is required'], trim: true },
        sku: { type: String, default: '' },
        purchasePrice: {
            type: Number,
            required: [true, 'Purchase price is required'],
            min: [0, 'Purchase price cannot be negative'],
        },
        sellingPrice: {
            type: Number,
            required: [true, 'Selling price is required'],
            min: [0, 'Selling price cannot be negative'],
        },
        stockQty: { type: Number, default: 0, min: 0 },
        lowStockThreshold: { type: Number, default: 5, min: 0 },
    },
    { timestamps: true }
);

productSchema.virtual('lowStock').get(function () {
    return this.stockQty <= this.lowStockThreshold;
});

productSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Product', productSchema);
