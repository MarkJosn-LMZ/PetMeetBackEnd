const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 所有路由都需要身份验证
router.use(authenticateToken);

// 体重记录路由
router.get('/weight', healthController.getWeightRecords);
router.get('/weight/:id', healthController.getWeightRecord);
router.post('/weight', healthController.createWeightRecord);
router.put('/weight/:id', healthController.updateWeightRecord);
router.delete('/weight/:id', healthController.deleteWeightRecord);

// 饮食记录路由
router.get('/diet', healthController.getDietRecords);
router.get('/diet/:id', healthController.getDietRecord);
router.post('/diet', healthController.createDietRecord);
router.put('/diet/:id', healthController.updateDietRecord);
router.delete('/diet/:id', healthController.deleteDietRecord);

// 运动记录路由
router.get('/exercise', healthController.getExerciseRecords);
router.get('/exercise/:id', healthController.getExerciseRecord);
router.post('/exercise', healthController.createExerciseRecord);
router.put('/exercise/:id', healthController.updateExerciseRecord);
router.delete('/exercise/:id', healthController.deleteExerciseRecord);

// 疫苗记录路由
router.get('/vaccine', healthController.getVaccineRecords);
router.get('/vaccine/:id', healthController.getVaccineRecord);
router.post('/vaccine', healthController.createVaccineRecord);
router.put('/vaccine/:id', healthController.updateVaccineRecord);
router.delete('/vaccine/:id', healthController.deleteVaccineRecord);

// 驱虫记录路由
router.get('/deworming', healthController.getDewormingRecords);
router.get('/deworming/:id', healthController.getDewormingRecord);
router.post('/deworming', healthController.createDewormingRecord);
router.put('/deworming/:id', healthController.updateDewormingRecord);
router.delete('/deworming/:id', healthController.deleteDewormingRecord);

// 体检记录路由
router.get('/examination', healthController.getExaminationRecords);
router.get('/examination/:id', healthController.getExaminationRecord);
router.post('/examination', healthController.createExaminationRecord);
router.put('/examination/:id', healthController.updateExaminationRecord);
router.delete('/examination/:id', healthController.deleteExaminationRecord);

// 宠物健康数据汇总路由 - 与前端请求匹配
router.get('/pet/:pet_id', healthController.getPetHealthSummary);

module.exports = router;
