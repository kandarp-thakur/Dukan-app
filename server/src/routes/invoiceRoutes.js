const express = require('express');
const { query, body } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { pdfUpload } = require('../middleware/pdfUpload');

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

// pdfUpload must run before the body validators so req.body is populated.
router.post(
    '/:id/email',
    authenticate,
    tenantScope,
    pdfUpload,
    body('to').trim().isEmail().withMessage('A valid recipient email is required'),
    body('subject').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
    validate,
    invoiceController.sendInvoiceEmail
);

router.post('/:id/share', authenticate, tenantScope, invoiceController.createShareLink);
router.delete('/:id/share', authenticate, tenantScope, invoiceController.revokeShareLink);

router.get('/:id', authenticate, tenantScope, invoiceController.getInvoice);

module.exports = router;
