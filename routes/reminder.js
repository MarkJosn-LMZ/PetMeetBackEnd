const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const reminderController = require('../controllers/reminderController');

// 获取特定宠物的日常提醒（喂食、运动等）
router.get('/pet/:pet_id/reminders/daily', authenticateToken, reminderController.getDailyReminders);

// 获取特定宠物的健康助手提醒（疫苗、驱虫、体检等）
router.get('/pet/:pet_id/reminders/health-assistant', authenticateToken, reminderController.getHealthAssistantReminders);

// 添加提醒
router.post('/pet/reminder', authenticateToken, reminderController.addReminder);

// 删除提醒
router.delete('/pet/reminder/:reminderId', authenticateToken, reminderController.deleteReminder);

// 更新提醒
router.put('/pet/reminder/:reminderId', authenticateToken, reminderController.updateReminder);

module.exports = router;
