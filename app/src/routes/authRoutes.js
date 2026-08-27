const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /auth/register
router.post('/register', authController.register);

// POST /auth/login
router.post('/login', authController.login);

// POST /auth/google
router.post('/google', authController.googleLogin);

// GET /auth/me
router.get('/me', authMiddleware, authController.me);

module.exports = router;
