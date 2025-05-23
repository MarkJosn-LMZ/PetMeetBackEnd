const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const { optional } = require('../middleware/authMiddleware');

// 获取热门话题
// 使用可选身份验证，因为未登录用户也可以查看话题
router.get('/hot', optional, topicController.getTopics);

// 搜索话题
// 使用可选身份验证，因为未登录用户也可以搜索话题
router.get('/search', optional, topicController.searchTopics);

module.exports = router;
