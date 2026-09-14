const express = require('express');
const invoiceController = require('../controllers/invoiceController');

const router = express.Router();

// Unauthenticated by design: the share token is the authorization.
router.get('/invoices/:token', invoiceController.getPublicInvoice);

module.exports = router;
