const express = require('express');
const router = express.Router();
const cloudStorageController = require('../controllers/cloudStorageController');
const { optional, authenticateToken } = require('../middleware/authMiddleware');

// 获取云存储文件的临时链接
// 可选的身份验证，因为获取公开文件链接不需要强制身份验证
router.post('/templinks', optional, cloudStorageController.getTemporaryLinks);

// 获取云存储文件列表
// 可选的身份验证，但在生产环境中可能需要更严格的权限控制
router.get('/list', optional, cloudStorageController.listFiles);

// 获取单个文件的HTTP临时链接 - 为小程序提供单文件URL转换服务
router.get('/file-url', optional, cloudStorageController.getFileUrl);

module.exports = router;
