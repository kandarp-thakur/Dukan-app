const express = require('express');
const configController = require('../controllers/configController');
const { authenticate, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/features', authenticate, tenantScope, configController.getFeatures);

module.exports = router;
