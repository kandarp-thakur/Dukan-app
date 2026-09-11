const Expense = require('../models/Expense');

exports.listExpenses = async (req, res) => {
    const expenses = await Expense.find({ businessId: req.businessId }).sort({ date: -1, createdAt: -1 });
    return res.json({ success: true, message: 'OK', data: { expenses } });
};

exports.createExpense = async (req, res) => {
    const { category, amount, paymentMethod, note, date } = req.body;
    const expense = await Expense.create({
        businessId: req.businessId,
        category,
        amount,
        paymentMethod,
        note: note || '',
        date: date || undefined,
    });
    return res.status(201).json({ success: true, message: 'Expense created', data: { expense } });
};

exports.updateExpense = async (req, res) => {
    const allowed = ['category', 'amount', 'paymentMethod', 'note', 'date'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
    }
    const expense = await Expense.findOneAndUpdate(
        { _id: req.params.id, businessId: req.businessId },
        updates,
        { new: true, runValidators: true }
    );
    if (!expense) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    return res.json({ success: true, message: 'Expense updated', data: { expense } });
};

exports.deleteExpense = async (req, res) => {
    const expense = await Expense.findOneAndDelete({
        _id: req.params.id,
        businessId: req.businessId,
    });
    if (!expense) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    return res.json({ success: true, message: 'Expense deleted', data: null });
};
