const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 获取宠物信息
router.get('/', authenticateToken, petController.getPet);

// 获取宠物列表
router.get('/list', authenticateToken, petController.getPetList);

// 获取特定宠物信息
router.get('/:pet_id', authenticateToken, petController.getPet);

// 添加宠物
router.post('/', authenticateToken, petController.addPet);

// 更新宠物
router.put('/:pet_id', authenticateToken, petController.updatePet);

// 删除宠物
router.delete('/:pet_id', authenticateToken, petController.deletePet);

module.exports = router;
