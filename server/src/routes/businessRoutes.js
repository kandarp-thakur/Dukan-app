const express = require('express');
const { body } = require('express-validator');
const businessController = require('../controllers/businessController');
const { authenticate, requireRole } = require('../middleware/auth');
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

module.exports = router;
