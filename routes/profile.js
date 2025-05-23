const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 用户资料路由
router.post('/user', authenticateToken, profileController.saveUserProfile);
router.get('/user', authenticateToken, profileController.getUserProfile);
router.delete('/user', authenticateToken, profileController.deleteUserProfile);

// 关注功能路由
router.post('/follow', authenticateToken, profileController.toggleFollow);
router.get('/follow/status/:targetUserId', authenticateToken, profileController.checkFollowStatus);

// 宠物资料路由
router.post('/pets', authenticateToken, profileController.savePetProfile);
router.get('/pets', authenticateToken, profileController.getPetProfiles);
router.get('/pets/:pet_id', authenticateToken, profileController.getPetProfile);
router.delete('/pets/:pet_id', authenticateToken, profileController.deletePetProfile);

// 兼容旧版
router.post('/', authenticateToken, profileController.saveProfile);
router.get('/', authenticateToken, profileController.getProfile);

module.exports = router;
