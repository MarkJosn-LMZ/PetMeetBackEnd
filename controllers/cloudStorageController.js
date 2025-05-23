/**
 * 云存储控制器
 * 用于处理与云存储相关的操作，如获取临时链接、上传文件等
 */

const { getCloudBase } = require('../config/cloudbaseConfig');

/**
 * 获取云存储文件的临时链接
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const getTemporaryLinks = async (req, res) => {
  try {
    const { fileList } = req.body;
    
    if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的文件路径列表',
      });
    }

    // 检查请求文件数量限制
    if (fileList.length > 100) {
      return res.status(400).json({
        success: false,
        message: '单次请求文件数量不能超过100个',
      });
    }

    console.log('获取临时链接的文件列表:', fileList);
    
    // 获取CloudBase实例
    const app = getCloudBase();
    
    // 获取临时文件链接
    const result = await app.getTempFileURL({
      fileList: fileList
    });
    
    console.log('获取临时链接结果:', result);
    
    if (result && result.fileList) {
      return res.status(200).json({
        success: true,
        data: result.fileList
      });
    } else {
      return res.status(500).json({
        success: false,
        message: '获取临时链接失败',
        error: '未返回有效的链接信息'
      });
    }
  } catch (error) {
    console.error('获取临时文件链接时出错:', error);
    return res.status(500).json({
      success: false,
      message: '获取临时文件链接时出错',
      error: error.message
    });
  }
};

/**
 * 获取指定前缀下的所有云存储文件
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const listFiles = async (req, res) => {
  try {
    const { prefix } = req.query;
    
    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的文件前缀'
      });
    }
    
    // 获取CloudBase实例
    const app = getCloudBase();
    
    // 获取存储管理实例
    const storage = app.storage();
    
    // 列出文件
    const result = await storage.listFiles({
      prefix: prefix
    });
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取云存储文件列表时出错:', error);
    return res.status(500).json({
      success: false,
      message: '获取云存储文件列表时出错',
      error: error.message
    });
  }
};

/**
 * 获取单个云存储文件的HTTP临时链接
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const getFileUrl = async (req, res) => {
  try {
    const { fileID } = req.query;
    
    if (!fileID) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的文件ID'
      });
    }

    console.log('获取文件URL:', fileID);
    
    // 获取CloudBase实例
    const app = getCloudBase();
    
    // 转换为临时链接
    const result = await app.getTempFileURL({
      fileList: [fileID]
    });
    
    console.log('获取文件URL结果:', result);
    
    if (result && result.fileList && result.fileList.length > 0) {
      return res.status(200).json({
        success: true,
        url: result.fileList[0].tempFileURL,
        fileID: fileID
      });
    } else {
      return res.status(404).json({
        success: false,
        message: '获取文件URL失败',
        fileID: fileID
      });
    }
  } catch (error) {
    console.error('获取文件URL错误:', error);
    return res.status(500).json({
      success: false,
      message: '获取文件URL时发生错误',
      error: error.message
    });
  }
};

// 导出所有函数
module.exports = {
  getTemporaryLinks,
  listFiles,
  getFileUrl
};
