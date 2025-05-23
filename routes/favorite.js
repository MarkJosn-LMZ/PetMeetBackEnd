const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const favoriteController = require('../controllers/favoriteController');

const router = express.Router();

/**
 * 收藏/取消收藏帖子
 * 需要登录认证
 */
router.post('/toggle', authenticateToken, favoriteController.toggleFavorite);

/**
 * 获取用户收藏列表
 * 需要登录认证
 */
router.get('/', authenticateToken, favoriteController.getUserFavorites);

/**
 * 检查帖子是否已收藏
 * 需要登录认证
 */
router.get('/check/:postId', authenticateToken, favoriteController.checkFavoriteStatus);

module.exports = router;
