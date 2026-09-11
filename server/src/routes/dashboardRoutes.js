const express = require('express');
const { query } = require('express-validator');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get(
    '/summary',
    authenticate,
    tenantScope,
    query('range').optional().isIn(['today', 'month']).withMessage('Range must be today or month'),
    validate,
    dashboardController.getSummary
);

module.exports = router;
