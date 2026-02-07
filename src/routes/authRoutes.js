const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Step 1: Send OTP
router.post('/send-code', authController.sendVerificationCode);

// Step 2: Verify OTP & Create Account
router.post('/verify-register', authController.verifyAndRegister);

// Login (Unchanged)
router.post('/login', authController.login);

module.exports = router;