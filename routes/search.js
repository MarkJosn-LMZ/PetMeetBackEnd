const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { optional } = require('../middleware/authMiddleware');

// 搜索帖子
// 使用可选身份验证，未登录用户也可以搜索
router.get('/posts', optional, searchController.searchPosts);

module.exports = router;
