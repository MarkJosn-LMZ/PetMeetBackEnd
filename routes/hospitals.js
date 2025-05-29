// routes/hospitals.js
// 医院搜索相关API

const express = require('express');
const router = express.Router();

// API调用频率控制
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 2000; // 2秒冷却时间（之前5秒太严格）
let requestCount = 0;
let requestResetTime = Date.now() + (60 * 1000); // 每分钟重置计数

/**
 * 检查API调用频率限制
 */
function checkRateLimit() {
  const now = Date.now();
  
  // 每分钟重置请求计数
  if (now > requestResetTime) {
    requestCount = 0;
    requestResetTime = now + (60 * 1000);
  }
  
  // 检查每分钟请求数限制（增加到30次，适应正常使用）
  if (requestCount >= 30) {
    return {
      allowed: false,
      reason: 'RATE_LIMIT_EXCEEDED',
      resetTime: requestResetTime
    };
  }
  
  // 检查连续请求间隔（放宽到2秒）
  if (now - lastRequestTime < REQUEST_COOLDOWN) {
    return {
      allowed: false,
      reason: 'TOO_FREQUENT',
      waitTime: REQUEST_COOLDOWN - (now - lastRequestTime)
    };
  }
  
  return { allowed: true };
}

/**
 * 搜索附近的宠物医院
 * GET /api/hospitals/nearby
 * 查询参数：
 * - longitude: 经度
 * - latitude: 纬度  
 * - radius: 搜索半径（米），默认10000
 * - limit: 结果数量限制，默认20
 */
router.get('/nearby', async (req, res) => {
  try {
    const { longitude, latitude, radius = 10000, limit = 20 } = req.query;
    
    // 参数验证
    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: '缺少经纬度参数'
      });
    }

    // 检查API调用频率限制
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      console.log(`[hospitals] API调用被限制: ${rateCheck.reason}`);
      
      // 返回失败状态，不提供虚假数据
      return res.json({
        success: false,
        message: 'API调用频率受限，请稍后重试',
        reason: rateCheck.reason,
        data: [],
        count: 0
      });
    }

    // 更新请求计数和时间
    requestCount++;
    lastRequestTime = Date.now();

    // 调用高德地图API搜索附近医院
    const hospitals = await searchNearbyHospitals(longitude, latitude, radius, limit);
    
    if (hospitals && hospitals.length > 0) {
      return res.json({
        success: true,
        data: hospitals,
        count: hospitals.length,
        fromCache: false
      });
    } else {
      // API返回空数据时返回失败状态
      return res.json({
        success: false,
        message: '未找到附近的宠物医院',
        data: [],
        count: 0
      });
    }
  } catch (error) {
    console.error('搜索附近医院失败:', error);
    
    // 错误时返回失败状态
    return res.json({
      success: false,
      message: '医院搜索服务暂时不可用',
      data: [],
      count: 0,
      error: error.message
    });
  }
});

/**
 * 逆地理编码API
 * GET /api/hospitals/geocode
 */
router.get('/geocode', async (req, res) => {
  try {
    const { longitude, latitude } = req.query;
    
    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: '缺少经纬度参数'
      });
    }

    // 检查频率限制
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      console.log(`[hospitals] 逆地理编码被限制: ${rateCheck.reason}`);
      return res.json({
        success: false,
        message: '位置服务暂时不可用',
        data: null
      });
    }

    requestCount++;
    lastRequestTime = Date.now();

    const locationInfo = await reverseGeocode(longitude, latitude);
    
    if (locationInfo) {
      return res.json({
        success: true,
        data: locationInfo
      });
    } else {
      return res.json({
        success: false,
        message: '无法获取位置信息',
        data: null
      });
    }
  } catch (error) {
    console.error('逆地理编码失败:', error);
    return res.json({
      success: false,
      message: '位置服务异常',
      data: null,
      error: error.message
    });
  }
});

/**
 * 正向地理编码API（地址转经纬度）
 * GET /api/hospitals/geocode/search
 */
router.get('/geocode/search', async (req, res) => {
  try {
    const { query: searchQuery } = req.query;
    
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        message: '缺少搜索关键词'
      });
    }

    // 检查频率限制
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      console.log(`[hospitals] 地理编码搜索被限制: ${rateCheck.reason}`);
      return res.json({
        success: false,
        message: '地理编码服务暂时不可用',
        data: null
      });
    }

    requestCount++;
    lastRequestTime = Date.now();

    const locationInfo = await forwardGeocode(searchQuery);
    
    if (locationInfo) {
      return res.json({
        success: true,
        data: locationInfo
      });
    } else {
      return res.json({
        success: false,
        message: '无法找到该地址的位置信息',
        data: null
      });
    }
  } catch (error) {
    console.error('地理编码搜索失败:', error);
    return res.json({
      success: false,
      message: '地理编码服务异常',
      data: null,
      error: error.message
    });
  }
});

/**
 * 获取医院详情
 * GET /api/hospitals/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 模拟医院详情数据
    const hospitalDetail = {
      id: id,
      name: '示例宠物医院',
      address: '示例地址',
      phone: '示例电话',
      description: '专业的宠物医疗服务',
      services: ['疫苗接种', '健康体检', '疾病治疗', '手术服务'],
      businessHours: '09:00-21:00',
      rating: '4.5'
    };
    
    return res.json({
      success: true,
      data: hospitalDetail
    });
  } catch (error) {
    console.error('获取医院详情失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取医院详情失败'
    });
  }
});

/**
 * 搜索附近宠物医院（调用高德地图API）
 * @param {string} longitude 经度
 * @param {string} latitude 纬度
 * @param {number} radius 搜索半径
 * @param {number} limit 结果数量限制
 * @returns {Promise<Array>} 医院列表
 */
async function searchNearbyHospitals(longitude, latitude, radius, limit) {
  const axios = require('axios');
  const apiKey = process.env.AMAP_API_KEY;
  
  if (!apiKey) {
    console.error('高德地图API Key未配置');
    return [];
  }

  try {
    console.log(`[hospitals] 调用高德地图v5 API搜索医院 - 位置: ${longitude},${latitude}`);
    
    // 使用v5版本的周边搜索API，可以获取更详细的信息
    const response = await axios.get('https://restapi.amap.com/v5/place/around', {
      params: {
        key: apiKey,
        location: `${longitude},${latitude}`,
        keywords: '宠物医院|动物医院|兽医院',
        radius: radius,
        limit: limit,
        extensions: 'all', // 重要：获取详细信息
        // v5版本的show_fields参数，明确指定需要的字段
        show_fields: 'business,business_area,opentime_today,opentime_week,tel,tag,rating,cost,alias,keytag,rectag,photos'
      },
      timeout: 10000 // 10秒超时
    });

    if (response.data.status === '0') {
      const errorCode = response.data.infocode;
      console.error('高德地图API返回错误:', {
        status: response.data.status,
        info: response.data.info,
        infocode: errorCode
      });
      
      // 特定错误处理
      if (errorCode === '10021') {
        console.warn('[hospitals] API调用超限，返回空数组');
      }
      
      return [];
    }

    const pois = response.data.pois || [];
    console.log(`[hospitals] 高德v5 API返回 ${pois.length} 个结果`);
    
    // 添加详细调试：输出前2个POI的原始数据
    if (pois.length > 0) {
      console.log('[hospitals] v5 API调试：前2个POI的原始数据:');
      pois.slice(0, 2).forEach((poi, index) => {
        console.log(`[hospitals] POI ${index}:`, {
          name: poi.name,
          rating: poi.rating,
          biz_ext: poi.biz_ext ? {
            rating: poi.biz_ext.rating,
            cost: poi.biz_ext.cost
          } : null,
          business: poi.business ? {
            rating: poi.business.rating,
            opentime_today: poi.business.opentime_today,
            opentime_week: poi.business.opentime_week,
            tel: poi.business.tel
          } : null,
          tel: poi.tel,
          photos: poi.photos ? poi.photos.length : 0
        });
      });
    }
    
    return processHospitalData(pois);
  } catch (error) {
    console.error('调用高德地图v5 API异常:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('[hospitals] 网络连接失败');
    } else if (error.code === 'ECONNABORTED') {
      console.error('[hospitals] 请求超时');
    }
    return [];
  }
}

/**
 * 逆地理编码（获取位置信息）
 * @param {string} longitude 经度
 * @param {string} latitude 纬度
 * @returns {Promise<Object>} 位置信息
 */
async function reverseGeocode(longitude, latitude) {
  const axios = require('axios');
  const apiKey = process.env.AMAP_API_KEY;

  if (!apiKey) {
    console.error('高德地图API Key未配置');
    return null;
  }

  try {
    const response = await axios.get('https://restapi.amap.com/v3/geocode/regeo', {
      params: {
        key: apiKey,
        location: `${longitude},${latitude}`,
        extensions: 'base'
      },
      timeout: 8000
    });

    if (response.data.status === '0') {
      console.error('逆地理编码API返回错误:', response.data);
      return null;
    }

    const regeocode = response.data.regeocode;
    if (regeocode && regeocode.addressComponent) {
      return {
        city: regeocode.addressComponent.city || '未知城市',
        district: regeocode.addressComponent.district || '未知区域',
        address: regeocode.formatted_address || '地址未知'
      };
    }

    return null;
  } catch (error) {
    console.error('逆地理编码异常:', error.message);
    return null;
  }
}

/**
 * 正向地理编码（地址转经纬度）
 * @param {string} address 地址字符串
 * @returns {Promise<Object>} 位置信息包括经纬度
 */
async function forwardGeocode(address) {
  const axios = require('axios');
  const apiKey = process.env.AMAP_API_KEY;

  if (!apiKey) {
    console.error('高德地图API Key未配置');
    return null;
  }

  try {
    console.log(`[hospitals] 正向地理编码搜索: ${address}`);
    
    const response = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
      params: {
        key: apiKey,
        address: address,
        city: '',  // 不限制城市，允许全国搜索
        output: 'JSON'
      },
      timeout: 8000
    });

    if (response.data.status === '0') {
      console.error('正向地理编码API返回错误:', response.data);
      return null;
    }

    const geocodes = response.data.geocodes;
    if (geocodes && geocodes.length > 0) {
      const firstResult = geocodes[0];
      const location = firstResult.location.split(',');
      
      console.log(`[hospitals] 地理编码成功: ${address} -> ${firstResult.formatted_address}`);
      
      return {
        longitude: parseFloat(location[0]),
        latitude: parseFloat(location[1]),
        address: firstResult.formatted_address || address,
        city: firstResult.city || '未知城市',
        district: firstResult.district || '未知区域',
        province: firstResult.province || '未知省份',
        adcode: firstResult.adcode || '',
        level: firstResult.level || ''
      };
    }

    console.log(`[hospitals] 未找到地址: ${address}`);
    return null;
  } catch (error) {
    console.error('正向地理编码异常:', error.message);
    return null;
  }
}

/**
 * 处理高德地图返回的POI数据
 * @param {Array} poisData 高德地图POI数据
 * @returns {Array} 处理后的医院数据
 */
function processHospitalData(poisData) {
  if (!Array.isArray(poisData)) {
    return [];
  }

  return poisData.map((poi) => {
    // 提取电话号码 - 优先级：business.tel > tel
    let phone = '';
    if (poi.business && poi.business.tel) {
      phone = poi.business.tel;
    } else if (poi.tel) {
      phone = poi.tel;
    }

    // 提取评分 - v5 API多个位置可能有评分信息
    let rating = '暂无';
    if (poi.biz_ext && poi.biz_ext.rating && poi.biz_ext.rating !== '[]' && poi.biz_ext.rating !== '') {
      // biz_ext.rating 是v5 API主要的评分字段
      const ratingNum = parseFloat(poi.biz_ext.rating);
      if (!isNaN(ratingNum) && ratingNum > 0) {
        rating = ratingNum.toFixed(1);
      }
    } else if (poi.rating && poi.rating !== '[]' && poi.rating !== '') {
      // 备选：顶层rating字段
      const ratingNum = parseFloat(poi.rating);
      if (!isNaN(ratingNum) && ratingNum > 0) {
        rating = ratingNum.toFixed(1);
      }
    } else if (poi.business && poi.business.rating && poi.business.rating !== '[]' && poi.business.rating !== '') {
      // 备选：business.rating字段
      const ratingNum = parseFloat(poi.business.rating);
      if (!isNaN(ratingNum) && ratingNum > 0) {
        rating = ratingNum.toFixed(1);
      }
    }

    // 特殊处理：如果是知名连锁医院，提供估算评分
    const hospitalName = (poi.name || '').toLowerCase();
    if (rating === '暂无' && (
      hospitalName.includes('芭比堂') || 
      hospitalName.includes('美联众合') || 
      hospitalName.includes('瑞鹏') ||
      hospitalName.includes('宠爱国际') ||
      hospitalName.includes('同和鑫')
    )) {
      rating = '4.2'; // 知名连锁医院的估算评分
    }

    // 提取营业时间 - v5 API的营业时间字段位置
    let businessHours = '';
    
    // 1. 优先从business对象获取
    if (poi.business) {
      businessHours = poi.business.opentime_today || 
                     poi.business.opentime_week || 
                     '';
    }
    
    // 2. 如果business没有，尝试从biz_ext获取（v5可能的位置）
    if (!businessHours && poi.biz_ext && poi.biz_ext.opentime) {
      businessHours = poi.biz_ext.opentime;
    }
    
    // 3. 检查是否名称中包含营业时间信息
    if (!businessHours && hospitalName.includes('24小时')) {
      businessHours = '24小时营业';
    }
    
    // 提取人均消费信息（如果有的话）
    let cost = '';
    if (poi.biz_ext && poi.biz_ext.cost && poi.biz_ext.cost !== '[]') {
      cost = poi.biz_ext.cost;
    }
    
    console.log(`[processHospitalData] ${poi.name} - 评分: ${rating}, 营业时间: "${businessHours}", 人均消费: "${cost}"`);

    return {
      id: poi.id || `poi_${Date.now()}_${Math.random()}`,
      name: poi.name || '未知医院',
      address: poi.address || poi.pname || '地址未知',
      phone: phone || '暂无电话',
      location: poi.location || '',
      distance: poi.distance || 0,
      rating: rating,
      businessHours: businessHours,
      cost: cost, // 新增：人均消费
      type: poi.type || '',
      typecode: poi.typecode || '',
      // 保留原始数据用于调试
      rawData: {
        business: poi.business,
        biz_ext: poi.biz_ext,
        photos: poi.photos ? poi.photos.length : 0
      }
    };
  });
}

module.exports = router; 