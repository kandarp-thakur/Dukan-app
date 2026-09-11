const express = require('express');
const planController = require('../controllers/planController');

const router = express.Router();

// Public catalog: no auth required.
router.get('/', planController.listPlans);

module.exports = router;
