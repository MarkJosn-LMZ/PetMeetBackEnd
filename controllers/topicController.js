/**
 * 话题控制器
 * 用于处理与话题相关的操作
 */

const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();

/**
 * 获取热门话题列表
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const getTopics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('获取热门话题, 页码:', page, '每页数量:', limit);
    
    // 从数据库获取话题列表
    const topicsRef = db.collection('topics');
    
    // 查询热门话题，按使用次数降序排列
    const topicsQuery = topicsRef
      .orderBy('usedCount', 'desc')
      .skip(skip)
      .limit(limit);
    
    const topics = await topicsQuery.get();
    
    return res.status(200).json({
      success: true,
      data: topics.data || []
    });
  } catch (error) {
    console.error('获取热门话题时出错:', error);
    return res.status(500).json({
      success: false,
      message: '获取热门话题时出错',
      error: error.message
    });
  }
};

/**
 * 搜索话题
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const searchTopics = async (req, res) => {
  try {
    const query = req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('搜索话题, 关键词:', query, '页码:', page, '每页数量:', limit);
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词'
      });
    }
    
    // 从数据库中搜索话题
    const topicsRef = db.collection('topics');
    const $ = db.command.aggregate;
    
    // 使用正则表达式进行模糊搜索
    const regexPattern = new RegExp(query, 'i');
    const topicsQuery = topicsRef
      .where({
        name: regexPattern
      })
      .orderBy('usedCount', 'desc')
      .skip(skip)
      .limit(limit);
    
    const topics = await topicsQuery.get();
    
    return res.status(200).json({
      success: true,
      data: topics.data || []
    });
  } catch (error) {
    console.error('搜索话题时出错:', error);
    return res.status(500).json({
      success: false,
      message: '搜索话题时出错',
      error: error.message
    });
  }
};

// 导出函数
module.exports = {
  getTopics,
  searchTopics
};
