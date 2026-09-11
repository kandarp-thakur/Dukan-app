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
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer (paise)'),
    body('method')
        .isIn(['cash', 'upi', 'card'])
        .withMessage('Method must be cash, upi or card'),
    body('note').optional({ values: 'falsy' }).trim(),
    validate,
    supplierController.recordSupplierPayment
);

module.exports = router;
