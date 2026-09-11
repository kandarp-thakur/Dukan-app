const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/low-stock', authenticate, tenantScope, productController.lowStock);

router.get('/', authenticate, tenantScope, productController.listProducts);

router.post(
    '/',
    authenticate,
    tenantScope,
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('purchasePrice').isInt({ min: 0 }).withMessage('Purchase price must be a non-negative integer (paise)'),
    body('sellingPrice').isInt({ min: 0 }).withMessage('Selling price must be a non-negative integer (paise)'),
    body('sku').optional({ values: 'falsy' }).trim(),
    body('stockQty').optional().isInt({ min: 0 }).withMessage('Stock qty must be a non-negative integer'),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer'),
    validate,
    productController.createProduct
);

router.patch(
    '/:id',
    authenticate,
    tenantScope,
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
    body('purchasePrice').optional().isInt({ min: 0 }).withMessage('Purchase price must be a non-negative integer (paise)'),
    body('sellingPrice').optional().isInt({ min: 0 }).withMessage('Selling price must be a non-negative integer (paise)'),
    body('stockQty').optional().isInt({ min: 0 }).withMessage('Stock qty must be a non-negative integer'),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer'),
    validate,
    productController.updateProduct
);

router.delete('/:id', authenticate, tenantScope, requireRole('owner'), productController.deleteProduct);

module.exports = router;
