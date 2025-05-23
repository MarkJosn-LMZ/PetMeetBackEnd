const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 发送手机验证码
router.post('/send-code', authController.sendVerificationCode);

// 手机号验证码登录
router.post('/phone-login', authController.loginWithPhoneCode);

module.exports = router;
