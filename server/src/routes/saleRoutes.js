const express = require('express');
const { body } = require('express-validator');
const saleController = require('../controllers/saleController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { INDIAN_STATES } = require('../utils/gst');

const router = express.Router();

router.get('/', authenticate, tenantScope, saleController.listSales);

router.post(
    '/',
    authenticate,
    tenantScope,
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid product ID'),
    body('items.*.name').trim().notEmpty().withMessage('Item name is required'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Qty must be a positive integer'),
    body('items.*.rate').isInt({ min: 0 }).withMessage('Rate must be a non-negative integer (paise)'),
    body('discount').optional().isInt({ min: 0 }).withMessage('Discount must be a non-negative integer (paise)'),
    body('tax').optional().isInt({ min: 0 }).withMessage('Tax must be a non-negative integer (paise)'),
    body('items.*.gstRate')
        .optional({ values: 'falsy' })
        .isInt()
        .isIn([0, 5, 12, 18, 28])
        .withMessage('GST rate must be one of 0, 5, 12, 18, 28'),
    body('items.*.hsn').optional({ values: 'falsy' }).trim(),
    body('isGst').optional().isBoolean().withMessage('isGst must be a boolean'),
    body('buyerGstin')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 15, max: 15 })
        .withMessage('GSTIN must be 15 characters'),
    body('buyerName').optional({ values: 'falsy' }).trim(),
    body('buyerAddress').optional({ values: 'falsy' }).trim(),
    body('placeOfSupply')
        .optional({ values: 'falsy' })
        .trim()
        .isIn(Object.keys(INDIAN_STATES))
        .withMessage('Invalid place of supply'),
    body('paymentMethod')
        .isIn(['cash', 'upi', 'card', 'credit'])
        .withMessage('Payment method must be cash, upi, card or credit'),
    body('customerId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid customer ID'),
    body('date').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date'),
    validate,
    saleController.createSale
);

router.patch(
    '/:id/cancel',
    authenticate,
    tenantScope,
    saleController.cancelSale
);

router.get('/:id', authenticate, tenantScope, saleController.getSale);

router.delete('/:id', authenticate, tenantScope, requireRole('owner'), saleController.deleteSale);

module.exports = router;
