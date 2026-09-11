const express = require('express');
const { body } = require('express-validator');
const businessController = require('../controllers/businessController');
const planController = require('../controllers/planController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, businessController.getBusiness);

router.patch(
  '/',
  authenticate,
  requireRole('owner'),
  body('name').optional().trim().notEmpty().withMessage('Business name cannot be empty'),
  body('gstin')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be 15 characters'),
  validate,
  businessController.updateBusiness
);

router.post(
  '/upgrade-request',
  authenticate,
  tenantScope,
  requireRole('owner'),
  body('plan').isIn(['free', 'pro']).withMessage('Plan must be free or pro'),
  validate,
  planController.requestUpgrade
);

module.exports = router;
