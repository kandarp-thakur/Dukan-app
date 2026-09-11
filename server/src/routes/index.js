const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/business', require('./businessRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/customers', require('./customerRoutes'));
router.use('/khata', require('./khataRoutes'));
router.use('/suppliers', require('./supplierRoutes'));
router.use('/purchases', require('./purchaseRoutes'));
router.use('/supplier-payments', require('./supplierPaymentRoutes'));
router.use('/sales', require('./saleRoutes'));
router.use('/expenses', require('./expenseRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/reports', require('./reportRoutes'));

module.exports = router;
