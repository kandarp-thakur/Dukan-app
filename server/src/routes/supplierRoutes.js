const express = require('express');
const { body } = require('express-validator');
const supplierController = require('../controllers/supplierController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/:id/statement', authenticate, tenantScope, supplierController.getStatement);

router.get('/', authenticate, tenantScope, supplierController.listSuppliers);

router.post(
    '/',
    authenticate,
    tenantScope,
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('phone').optional({ values: 'falsy' }).trim(),
    validate,
    supplierController.createSupplier
);

router.patch(
    '/:id',
    authenticate,
    tenantScope,
    body('name').optional().trim().notEmpty().withMessage('Supplier name cannot be empty'),
    body('phone').optional({ values: 'falsy' }).trim(),
    validate,
    supplierController.updateSupplier
);

router.delete('/:id', authenticate, tenantScope, requireRole('owner'), supplierController.deleteSupplier);

module.exports = router;
