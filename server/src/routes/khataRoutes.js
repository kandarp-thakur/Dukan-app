const express = require('express');
const { body } = require('express-validator');
const customerController = require('../controllers/customerController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
    '/payments',
    authenticate,
    tenantScope,
    body('customerId').isMongoId().withMessage('Valid customerId is required'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer (paise)'),
    body('note').optional({ values: 'falsy' }).trim(),
    validate,
    customerController.recordPayment
);

module.exports = router;
