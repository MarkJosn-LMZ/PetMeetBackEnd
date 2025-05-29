const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 用户资料路由
router.post('/user', authenticateToken, profileController.saveUserProfile);
router.get('/user', authenticateToken, profileController.getUserProfile);
router.delete('/user', authenticateToken, profileController.deleteUserProfile);

// 获取所有用户列表（用于管理和测试）
router.get('/users/all', authenticateToken, profileController.getAllUsers);

// 关注功能路由
router.post('/follow', authenticateToken, profileController.toggleFollow);
router.get('/follow/status', authenticateToken, profileController.checkFollowStatus);

// 宠物资料路由
router.post('/pet', authenticateToken, profileController.savePetProfile);
router.get('/pets', authenticateToken, profileController.getPetProfiles);
router.get('/pet/:petId', authenticateToken, profileController.getPetProfile);
router.delete('/pet/:petId', authenticateToken, profileController.deletePetProfile);

// 兼容旧版
router.post('/', authenticateToken, profileController.saveProfile);
router.get('/', authenticateToken, profileController.getProfile);

module.exports = router;
