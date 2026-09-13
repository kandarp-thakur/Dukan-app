const express = require('express');
const { query } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get(
    '/',
    authenticate,
    tenantScope,
    query('type').optional({ values: 'falsy' }).isIn(['gst', 'non-gst']).withMessage('Invalid invoice type'),
    query('from').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid from date'),
    query('to').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid to date'),
    validate,
    invoiceController.listInvoices
);

router.get('/:id', authenticate, tenantScope, invoiceController.getInvoice);

module.exports = router;
