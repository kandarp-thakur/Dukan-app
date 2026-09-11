const express = require('express');
const { query } = require('express-validator');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, tenantScope, requireRole('owner'));

router.get(
    '/daily',
    query('date').optional().isISO8601().withMessage('Invalid date'),
    validate,
    dashboardController.getDailyReport
);

router.get(
    '/monthly',
    query('month').optional().matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM'),
    validate,
    dashboardController.getMonthlyReport
);

router.get('/outstanding', dashboardController.getOutstandingReport);

module.exports = router;
