const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { optional, authenticateToken } = require('../middleware/authMiddleware');

// 获取帖子流
// 注意：这里使用可选的身份验证，因为未登录用户也可以查看公开内容
router.get('/feed', optional, postController.getPostFeed);

// 获取帖文详情
// 同样使用可选的身份验证，未登录用户可以查看公开帖子的详情
router.get('/detail/:postId', optional, postController.getPostDetail);

// 创建帖子路由
// 使用postController中的createPost函数
router.post('/create', authenticateToken, postController.createPost);

// 删除帖文路由
// 需要身份验证，只有帖文作者能删除自己的帖文
router.delete('/:postId', authenticateToken, postController.deletePost);

module.exports = router;
