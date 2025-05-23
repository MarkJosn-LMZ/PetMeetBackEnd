const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 获取会员等级信息列表 - 需要身份验证
router.get('/tiers', authenticateToken, membershipController.getMembershipTiers);

// 获取用户会员信息 - 需要身份验证
router.get('/', authenticateToken, membershipController.getUserMembership);

// 创建或更新用户会员信息 - 需要身份验证
router.post('/', authenticateToken, membershipController.createOrUpdateMembership);

// 会员购买处理 - 需要身份验证
router.post('/purchase', authenticateToken, membershipController.purchaseMembership);

module.exports = router;
