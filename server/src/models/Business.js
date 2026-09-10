const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Business name is required'], trim: true },
    logoUrl: { type: String, default: '' },
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    invoicePrefix: { type: String, default: 'INV' },
    invoiceCounter: { type: Number, default: 0 },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    planExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

businessSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Business', businessSchema);
