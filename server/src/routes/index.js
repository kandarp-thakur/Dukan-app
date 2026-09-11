const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/business', require('./businessRoutes'));
router.use('/products', require('./productRoutes'));

module.exports = router;
