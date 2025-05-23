const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likeController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 点赞路由
router.post('/toggle', authenticateToken, likeController.toggleLike);
router.get('/status/:postId', authenticateToken, likeController.checkLikeStatus);

module.exports = router;
