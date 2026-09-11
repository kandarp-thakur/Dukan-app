const User = require('../models/User');

exports.listUsers = async (req, res) => {
    const users = await User.find({ businessId: req.businessId }).sort({ createdAt: 1 });
    return res.json({ success: true, message: 'OK', data: { users } });
};

exports.createUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    const user = await User.create({
        name,
        email,
        password,
        role: role || 'staff',
        businessId: req.businessId,
    });
    return res.status(201).json({ success: true, message: 'User created', data: { user } });
};

exports.updateUserRole = async (req, res) => {
    const { role } = req.body;
    if (!['owner', 'staff'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Role must be owner or staff' });
    }
    const user = await User.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user._id.toString() === req.user.id && role !== 'owner') {
        return res.status(400).json({ success: false, message: 'You cannot demote yourself' });
    }
    user.role = role;
    await user.save();
    return res.json({ success: true, message: 'Role updated', data: { user } });
};

exports.deleteUser = async (req, res) => {
    if (req.params.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'You cannot delete yourself' });
    }
    const user = await User.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, message: 'User deleted', data: null });
};
