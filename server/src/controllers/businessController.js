const Business = require('../models/Business');

exports.getBusiness = async (req, res) => {
  const business = await Business.findById(req.user.businessId);
  if (!business) {
    return res.status(404).json({ success: false, message: 'Business not found' });
  }
  return res.json({ success: true, message: 'OK', data: { business: business.toJSON() } });
};

exports.updateBusiness = async (req, res) => {
  const allowed = ['name', 'address', 'gstin', 'currency', 'invoicePrefix'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  const business = await Business.findByIdAndUpdate(req.user.businessId, updates, {
    new: true,
    runValidators: true,
  });
  if (!business) {
    return res.status(404).json({ success: false, message: 'Business not found' });
  }
  return res.json({ success: true, message: 'Business updated', data: { business: business.toJSON() } });
};
