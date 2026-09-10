const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/business', require('./businessRoutes'));

module.exports = router;
