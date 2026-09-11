const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

const PAID_METHODS = ['cash', 'upi', 'card'];

// Aggregates sales and expenses inside [start, end).
const aggregateSalesExpenses = async (businessId, start, end) => {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const [salesAgg] = await Sale.aggregate([
        {
            $match: {
                businessId: businessObjectId,
                status: 'completed',
                date: { $gte: start, $lt: end },
            },
        },
        {
            $group: {
                _id: null,
                salesTotal: { $sum: '$total' },
                cashIn: {
                    $sum: {
                        $cond: [{ $in: ['$paymentMethod', PAID_METHODS] }, '$total', 0],
                    },
                },
            },
        },
    ]);
    const [expensesAgg] = await Expense.aggregate([
        {
            $match: {
                businessId: businessObjectId,
                date: { $gte: start, $lt: end },
            },
        },
        {
            $group: {
                _id: null,
                expensesTotal: { $sum: '$amount' },
                cashOut: {
                    $sum: {
                        $cond: [{ $in: ['$paymentMethod', PAID_METHODS] }, '$amount', 0],
                    },
                },
            },
        },
    ]);
    return {
        salesTotal: salesAgg ? salesAgg.salesTotal : 0,
        cashIn: salesAgg ? salesAgg.cashIn : 0,
        expensesTotal: expensesAgg ? expensesAgg.expensesTotal : 0,
        cashOut: expensesAgg ? expensesAgg.cashOut : 0,
    };
};

// Lifetime cash position: paid sales − paid expenses − paid purchases − supplier payments.
const computeCashBalance = async (businessId) => {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);
    const [salesAgg] = await Sale.aggregate([
        { $match: { businessId: businessObjectId, status: 'completed', paymentMethod: { $in: PAID_METHODS } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const [expensesAgg] = await Expense.aggregate([
        { $match: { businessId: businessObjectId, paymentMethod: { $in: PAID_METHODS } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const [purchasesAgg] = await Purchase.aggregate([
        { $match: { businessId: businessObjectId, paymentMethod: { $in: PAID_METHODS } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const [supplierPaymentsAgg] = await SupplierPayment.aggregate([
        { $match: { businessId: businessObjectId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return (
        (salesAgg ? salesAgg.total : 0) -
        (expensesAgg ? expensesAgg.total : 0) -
        (purchasesAgg ? purchasesAgg.total : 0) -
        (supplierPaymentsAgg ? supplierPaymentsAgg.total : 0)
    );
};

const outstandingTotals = async (businessId) => {
    const [receivableAgg] = await Customer.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(businessId), balance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);
    const [payableAgg] = await Supplier.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(businessId), balance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);
    return {
        receivable: receivableAgg ? receivableAgg.total : 0,
        payable: payableAgg ? payableAgg.total : 0,
    };
};

exports.getSummary = async (req, res) => {
    const range = req.query.range === 'month' ? 'month' : 'today';
    const now = new Date();
    let start;
    let end;
    if (range === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    const { salesTotal, expensesTotal } = await aggregateSalesExpenses(req.businessId, start, end);
    const cashBalance = await computeCashBalance(req.businessId);
    const { receivable, payable } = await outstandingTotals(req.businessId);

    // v1 simplification per spec: profit = sales − expenses (COGS deferred).
    const summary = {
        range,
        salesTotal,
        expensesTotal,
        profit: salesTotal - expensesTotal,
        cashBalance,
        receivable,
        payable,
    };
    return res.json({ success: true, message: 'OK', data: { summary } });
};

exports.getDailyReport = async (req, res) => {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date' });
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const { salesTotal, expensesTotal } = await aggregateSalesExpenses(req.businessId, start, end);
    const report = {
        date: dateStr,
        salesTotal,
        expensesTotal,
        profit: salesTotal - expensesTotal,
    };
    return res.json({ success: true, message: 'OK', data: { report } });
};

exports.getMonthlyReport = async (req, res) => {
    const monthStr = req.query.month || new Date().toISOString().slice(0, 7);
    const start = new Date(`${monthStr}-01T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid month' });
    }
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const { salesTotal, expensesTotal } = await aggregateSalesExpenses(req.businessId, start, end);
    const report = {
        month: monthStr,
        salesTotal,
        expensesTotal,
        profit: salesTotal - expensesTotal,
    };
    return res.json({ success: true, message: 'OK', data: { report } });
};

exports.getOutstandingReport = async (req, res) => {
    const receivables = await Customer.find({
        businessId: req.businessId,
        balance: { $gt: 0 },
    })
        .sort({ balance: -1 })
        .select('name phone balance');
    const payables = await Supplier.find({
        businessId: req.businessId,
        balance: { $gt: 0 },
    })
        .sort({ balance: -1 })
        .select('name phone balance');
    const report = {
        receivableTotal: receivables.reduce((sum, c) => sum + c.balance, 0),
        payableTotal: payables.reduce((sum, s) => sum + s.balance, 0),
        receivables,
        payables,
    };
    return res.json({ success: true, message: 'OK', data: { report } });
};
