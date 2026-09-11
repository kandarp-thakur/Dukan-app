const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate, tenantScope, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate, tenantScope, requireRole('owner'));

router.get('/', userController.listUsers);

router.post(
    '/',
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['owner', 'staff']).withMessage('Role must be owner or staff'),
    validate,
    userController.createUser
);

router.patch(
    '/:id/role',
    body('role').isIn(['owner', 'staff']).withMessage('Role must be owner or staff'),
    validate,
    userController.updateUserRole
);

router.delete('/:id', userController.deleteUser);

module.exports = router;
