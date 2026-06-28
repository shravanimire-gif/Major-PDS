const express = require('express');
const { login, sendOtp, verifyOtp } = require('../controllers/authController');
const validate = require('../middleware/validate');
const { loginSchema, otpSendSchema, otpVerifySchema } = require('../validators/auth');

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/otp/send', validate(otpSendSchema), sendOtp);
router.post('/otp/verify', validate(otpVerifySchema), verifyOtp);
router.all('/otp/send', (req, res) => {
  return res.status(405).json({ error: 'Method not allowed. Use POST /auth/otp/send' });
});
router.all('/otp/verify', (req, res) => {
  return res.status(405).json({ error: 'Method not allowed. Use POST /auth/otp/verify' });
});

module.exports = router;
