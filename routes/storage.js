const express = require('express');
const router = express.Router();
const { getCloudBase } = require('../config/cloudbaseConfig');

// 获取临时文件URL
router.get('/file-url', async (req, res) => {
  try {
    const { fileID } = req.query;
    
    if (!fileID) {
      return res.status(400).json({
        success: false,
        message: '缺少fileID参数'
      });
    }
    
    // 清理fileID，确保格式正确
    // 如果前端传入的是完整路径(cloud://xxx)，则直接使用
    // 如果是相对路径，则添加cloud://前缀
    const normalizedFileID = fileID.startsWith('cloud://') 
      ? fileID 
      : `cloud://${process.env.CLOUDBASE_ENV_ID}.${process.env.CLOUDBASE_ENV_ID}-1353074235/${fileID}`;
    
    // 已移除日志输出
    
    // 获取CloudBase实例
    const app = getCloudBase();
    
    // 获取临时文件URL，有效期24小时
    const result = await app.getTempFileURL({
      fileList: [normalizedFileID],
      maxAge: 86400
    });
    
    if (result.fileList && result.fileList.length > 0) {
      const fileInfo = result.fileList[0];
      
      if (fileInfo.code === 'SUCCESS') {
        return res.json({
          success: true,
          url: fileInfo.tempFileURL
        });
      } else {
        // 已移除错误日志输出
        return res.status(404).json({
          success: false,
          message: `获取文件URL失败: ${fileInfo.code}`
        });
      }
    } else {
      return res.status(500).json({
        success: false,
        message: '获取文件URL失败: 未知错误'
      });
    }
  } catch (error) {
    // 已移除异常日志输出
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 批量获取临时文件URL
router.post('/batch-file-urls', async (req, res) => {
  try {
    const { fileIDs } = req.body;
    
    if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少fileIDs参数或格式不正确'
      });
    }
    
    // 预处理所有文件ID
    const normalizedFileIDs = fileIDs.map(fileID => 
      fileID.startsWith('cloud://') 
        ? fileID 
        : `cloud://${process.env.CLOUDBASE_ENV_ID}.${process.env.CLOUDBASE_ENV_ID}-1353074235/${fileID}`
    );
    
    // 已移除批量日志输出
    
    // 获取CloudBase实例
    const app = getCloudBase();
    
    // 分批处理，避免一次性请求过多
    const batchSize = 50;
    const results = [];
    
    for (let i = 0; i < normalizedFileIDs.length; i += batchSize) {
      const batch = normalizedFileIDs.slice(i, i + batchSize);
      const batchResult = await app.getTempFileURL({
        fileList: batch,
        maxAge: 86400
      });
      
      if (batchResult.fileList) {
        results.push(...batchResult.fileList);
      }
    }
    
    // 构建结果映射
    const urlMap = {};
    results.forEach(item => {
      if (item.code === 'SUCCESS') {
        urlMap[item.fileID] = item.tempFileURL;
      } else {
        urlMap[item.fileID] = null;
      }
    });
    
    return res.json({
      success: true,
      urls: urlMap
    });
  } catch (error) {
    console.error('[存储API] 批量获取文件URL异常:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
