const express = require('express');
const { body } = require('express-validator');
const customerController = require('../controllers/customerController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/:id/khata', authenticate, tenantScope, customerController.getKhata);

router.get('/', authenticate, tenantScope, customerController.listCustomers);

router.post(
    '/',
    authenticate,
    tenantScope,
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').optional({ values: 'falsy' }).trim(),
    validate,
    customerController.createCustomer
);

router.patch(
    '/:id',
    authenticate,
    tenantScope,
    body('name').optional().trim().notEmpty().withMessage('Customer name cannot be empty'),
    body('phone').optional({ values: 'falsy' }).trim(),
    validate,
    customerController.updateCustomer
);

router.delete('/:id', authenticate, tenantScope, requireRole('owner'), customerController.deleteCustomer);

module.exports = router;
