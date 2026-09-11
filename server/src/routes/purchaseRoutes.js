const express = require('express');
const { body } = require('express-validator');
const supplierController = require('../controllers/supplierController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
    '/',
    authenticate,
    tenantScope,
    body('supplierId').isMongoId().withMessage('Valid supplierId is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid productId'),
    body('items.*.name').trim().notEmpty().withMessage('Item name is required'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Item qty must be at least 1'),
    body('items.*.cost').isInt({ min: 0 }).withMessage('Item cost must be a non-negative integer (paise)'),
    body('paymentMethod')
        .isIn(['cash', 'upi', 'card', 'credit'])
        .withMessage('Payment method must be cash, upi, card or credit'),
    validate,
    supplierController.createPurchase
);

router.get('/', authenticate, tenantScope, supplierController.listPurchases);

module.exports = router;
