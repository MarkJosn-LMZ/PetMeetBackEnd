const express = require('express');
const router = express.Router();
const { getComments, addComment, deleteComment } = require('../controllers/commentController');
const { optional, authenticateToken } = require('../middleware/authMiddleware');

// 获取帖子评论列表
// 使用可选的身份验证，未登录用户也可以查看公开评论
router.get('/:postId', optional, getComments);

// 添加评论
// 需要强制认证，只有登录用户才能发表评论
router.post('/', authenticateToken, addComment);

// 删除评论
router.delete('/:commentId', authenticateToken, deleteComment);

module.exports = router;
