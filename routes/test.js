const express = require('express');
const router = express.Router();
const { initCloudBase, getDatabase } = require('../config/cloudbaseConfig');

// 测试Cloudbase连接
router.get('/cloudbase-connection', async (req, res) => {
  try {
    // 尝试初始化Cloudbase
    const app = initCloudBase();
    
    // 尝试获取数据库实例
    const db = app.database();
    
    // 尝试执行一个简单的查询操作来验证连接
    try {
      // 创建一个临时集合用于测试，如果不存在则不会抛出错误
      const testCollection = db.collection('connection_test');
      
      // 执行一个简单的查询操作
      const queryResult = await testCollection.limit(1).get();
      
      // 如果没有抛出异常，说明连接成功
      res.json({
        success: true,
        message: 'Cloudbase连接成功',
        env: process.env.CLOUDBASE_ENV_ID,
        dbConnected: true,
        queryResult: queryResult
      });
    } catch (dbError) {
      // 数据库操作失败，但可能是集合不存在，而不是连接问题
      console.error('数据库操作失败:', dbError);
      res.status(500).json({
        success: false,
        message: '数据库操作失败，但SDK初始化可能成功',
        error: dbError.message
      });
    }
  } catch (error) {
    console.error('Cloudbase连接测试失败:', error);
    res.status(500).json({
      success: false,
      message: 'Cloudbase连接失败',
      error: error.message
    });
  }
});

module.exports = router;
