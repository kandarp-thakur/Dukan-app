const express = require('express');
const { body } = require('express-validator');
const expenseController = require('../controllers/expenseController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, tenantScope, expenseController.listExpenses);

router.post(
    '/',
    authenticate,
    tenantScope,
    body('category')
        .isIn(['rent', 'salary', 'stock', 'transport', 'electricity', 'other'])
        .withMessage('Invalid category'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer (paise)'),
    body('paymentMethod')
        .isIn(['cash', 'upi', 'card'])
        .withMessage('Payment method must be cash, upi or card'),
    body('note').optional({ values: 'falsy' }).trim(),
    body('date').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date'),
    validate,
    expenseController.createExpense
);

router.patch(
    '/:id',
    authenticate,
    tenantScope,
    body('category')
        .optional()
        .isIn(['rent', 'salary', 'stock', 'transport', 'electricity', 'other'])
        .withMessage('Invalid category'),
    body('amount').optional().isInt({ min: 1 }).withMessage('Amount must be a positive integer (paise)'),
    body('paymentMethod')
        .optional()
        .isIn(['cash', 'upi', 'card'])
        .withMessage('Payment method must be cash, upi or card'),
    body('note').optional({ values: 'falsy' }).trim(),
    body('date').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date'),
    validate,
    expenseController.updateExpense
);

router.delete('/:id', authenticate, tenantScope, requireRole('owner'), expenseController.deleteExpense);

module.exports = router;
