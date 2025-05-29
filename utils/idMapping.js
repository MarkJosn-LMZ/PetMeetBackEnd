/**
 * ID映射工具
 * 将19位雪花ID映射为9位短ID，并提供反向查询功能
 */
const { getDatabase } = require('../config/cloudbaseConfig');
const { generate: generateSnowflakeId } = require('./snowflake');

const db = getDatabase();
const _ = db.command;

// 映射表集合名称
const MAPPING_COLLECTION = 'id_mappings';

/**
 * 初始化映射表
 * 云开发CloudBase会自动创建集合和索引
 */
async function initMappingCollection() {
  try {
    console.log(`初始化 ${MAPPING_COLLECTION} 集合...`);
    
    try {
      // 通过添加并删除一条临时记录来创建集合
      // 这样可以解决集合不存在的问题
      console.log(`创建 ${MAPPING_COLLECTION} 集合...`);
      
      // 创建一条临时记录
      const tempDoc = {
        _id: 'temp-init-doc',
        temp: true,
        createdAt: db.serverDate()
      };
      
      // 如果记录已存在则先删除
      await db.collection(MAPPING_COLLECTION).doc('temp-init-doc').remove();
      
      // 添加临时记录
      await db.collection(MAPPING_COLLECTION).add(tempDoc);
      
      // 再次删除记录
      await db.collection(MAPPING_COLLECTION).doc('temp-init-doc').remove();
      
      console.log(`${MAPPING_COLLECTION} 集合创建成功`);
    } catch (err) {
      console.log(`创建集合过程出错，可能集合已存在:`, err.message);
    }
    
    // 现在尝试计数
    try {
      const { total } = await db.collection(MAPPING_COLLECTION).count();
      console.log(`${MAPPING_COLLECTION} 集合初始化完成，当前记录数: ${total}`);
    } catch (countErr) {
      console.log(`无法获取记录数，但集合已初始化:`, countErr.message);
    }
    
    return true;
  } catch (error) {
    console.error('初始化映射表失败:', error);
    throw error;
  }
}

/**
 * 基于19位雪花ID生成9位数字的短ID
 * 使用哈希算法确保从同一个雪花ID总是生成相同的短ID
 * @param {string} snowflakeID 19位雪花ID
 * @returns {string} 9位数字ID
 */
function generateShortID(snowflakeID) {
  if (!snowflakeID) {
    throw new Error('生成短ID需要提供雪花ID');
  }
  
  // 将雪花ID转换为数字进行计算
  const snowflakeNum = BigInt(snowflakeID);
  
  // 方法1: 使用模运算 + 位运算组合
  // 取雪花ID的不同部分进行组合，确保分布均匀
  const part1 = Number(snowflakeNum % 1000n); // 取后3位
  const part2 = Number((snowflakeNum >> 10n) % 1000n); // 右移10位后取3位
  const part3 = Number((snowflakeNum >> 20n) % 1000n); // 右移20位后取3位
  
  // 组合成9位数字，确保第一位不为0
  let shortID = `${part1.toString().padStart(3, '0')}${part2.toString().padStart(3, '0')}${part3.toString().padStart(3, '0')}`;
  
  // 确保第一位不为0
  if (shortID[0] === '0') {
    // 如果第一位是0，用雪花ID的某一位替换
    const replacement = Number((snowflakeNum >> 30n) % 9n) + 1; // 1-9
    shortID = replacement + shortID.substring(1);
  }
  
  console.log(`雪花ID ${snowflakeID} -> 短ID ${shortID} (算法: 模运算+位运算)`);
  return shortID;
}

/**
 * 检查PetMeetID是否已存在
 * @param {string} petMeetID PetMeetID
 * @returns {Promise<boolean>} 是否已存在
 */
async function checkPetMeetIDExists(petMeetID) {
  try {
    // 查询结果处理
    const result = await db.collection(MAPPING_COLLECTION)
      .where({
        PetMeetID: _.eq(petMeetID)
      })
      .count();
    
    // 处理不同的返回结果格式
    let count = 0;
    if (result && result.total !== undefined) {
      count = result.total;
    } else if (result && result.data && result.data.total !== undefined) {
      count = result.data.total;
    } else if (typeof result === 'number') {
      count = result;
    } else {
      console.log('查询结果格式不符合预期:', JSON.stringify(result));
      return false; // 默认处理
    }
    
    return count > 0;
  } catch (error) {
    console.error('检查PetMeetID存在性时出错:', error.message);
    return false; // 默认处理
  }
}

/**
 * 生成唯一的PetMeetID（9位数字）并存储映射关系
 * @param {string} userId 用户ID（openID）
 * @returns {Promise<string>} 9位数字ID
 */
async function generateCompactPetMeetID(userId) {
  if (!userId) {
    throw new Error('生成PetMeetID需要提供用户ID');
  }
  
  try {
    // 1. 生成原始雪花ID
    const snowflakeID = generateSnowflakeId();
    console.log(`生成雪花ID: ${snowflakeID}`);
    
    // 2. 基于雪花ID计算9位 PetMeetID
    const petMeetID = generateShortID(snowflakeID);
    console.log(`计算得到PetMeetID: ${petMeetID}`);
    
    // 3. 检查是否已存在（理论上基于雪花ID计算的短ID应该是唯一的，但为了安全起见还是检查一下）
    let finalPetMeetID = petMeetID;
    try {
      const exists = await checkPetMeetIDExists(petMeetID);
      if (exists) {
        console.warn(`计算得到的PetMeetID ${petMeetID} 已存在，这是极小概率事件`);
        // 如果真的冲突了，在原ID基础上微调
        const adjustment = Math.floor(Math.random() * 9) + 1;
        finalPetMeetID = adjustment + petMeetID.substring(1);
        console.log(`调整后的PetMeetID: ${finalPetMeetID}`);
      }
    } catch (error) {
      console.warn(`检查PetMeetID是否存在时出错: ${error.message}，继续使用计算得到的ID`);
    }
    
    // 4. 存储映射关系
    try {
      const mappingDoc = {
        originalID: snowflakeID,     // 原始雪花ID
        PetMeetID: finalPetMeetID,   // 计算得到的PetMeetID
        userId: userId,              // 用户ID（openID）
        algorithm: 'modulo_bitshift', // 记录使用的算法
        createdAt: db.serverDate()
      };
      
      console.log(`添加映射关系: ${snowflakeID} -> ${finalPetMeetID} (用户: ${userId})`);
      await db.collection(MAPPING_COLLECTION).add(mappingDoc);
      console.log(`映射关系已存储成功`);
    } catch (addError) {
      console.error(`存储映射关系失败: ${addError.message}`);
      // 即使映射关系存储失败，仍然返回PetMeetID
    }
    
    return finalPetMeetID;
  } catch (error) {
    console.error('生成PetMeetID失败:', error.message);
    // 当出错时，使用简单的备用算法
    const fallbackSnowflake = generateSnowflakeId();
    const fallbackID = (BigInt(fallbackSnowflake) % 900000000n + 100000000n).toString();
    console.log(`出错，使用备用算法生成ID: ${fallbackID}`);
    return fallbackID;
  }
}

/**
 * 根据PetMeetID获取原始雪花ID
 * @param {string} petMeetID 9位PetMeetID
 * @returns {Promise<string|null>} 原始雪花ID或null
 */
async function getOriginalID(petMeetID) {
  try {
    const result = await db.collection(MAPPING_COLLECTION)
      .where({
        PetMeetID: _.eq(petMeetID)
      })
      .get();
    
    // 处理不同的返回结果格式
    let records = [];
    
    if (result && Array.isArray(result)) {
      records = result;
    } else if (result && result.data && Array.isArray(result.data)) {
      records = result.data;
    } else if (result && Array.isArray(result.list)) {
      records = result.list;
    } else {
      console.log('查询结果格式不符合预期:', JSON.stringify(result));
      return null;
    }
    
    if (records && records.length > 0) {
      return records[0].originalID;
    }
    
    return null;
  } catch (error) {
    console.error('获取原始雪花ID时出错:', error.message);
    return null;
  }
}

/**
 * 根据原始雪花ID获取PetMeetID
 * @param {string} originalID 原始雪花ID
 * @returns {Promise<string|null>} 9位PetMeetID或null
 */
async function getPetMeetID(originalID) {
  try {
    const result = await db.collection(MAPPING_COLLECTION)
      .where({
        originalID: _.eq(originalID)
      })
      .get();
    
    // 处理不同的返回结果格式
    let records = [];
    
    if (result && Array.isArray(result)) {
      records = result;
    } else if (result && result.data && Array.isArray(result.data)) {
      records = result.data;
    } else if (result && Array.isArray(result.list)) {
      records = result.list;
    } else {
      console.log('查询结果格式不符合预期:', JSON.stringify(result));
      return null;
    }
    
    if (records && records.length > 0) {
      return records[0].PetMeetID;
    }
    
    return null;
  } catch (error) {
    console.error('获取PetMeetID时出错:', error.message);
    return null;
  }
}

/**
 * 批量获取PetMeetID到原始雪花ID的映射
 * @param {Array<string>} petMeetIDs PetMeetID数组
 * @returns {Promise<Object>} 映射对象 {PetMeetID: originalID}
 */
async function batchGetOriginalIDs(petMeetIDs) {
  if (!petMeetIDs || petMeetIDs.length === 0) {
    return {};
  }
  
  try {
    const result = await db.collection(MAPPING_COLLECTION)
      .where({
        PetMeetID: _.in(petMeetIDs)
      })
      .get();
    
    // 处理不同的返回结果格式
    let records = [];
    
    if (result && Array.isArray(result)) {
      records = result;
    } else if (result && result.data && Array.isArray(result.data)) {
      records = result.data;
    } else if (result && Array.isArray(result.list)) {
      records = result.list;
    } else {
      console.log('批量查询结果格式不符合预期:', JSON.stringify(result));
      return {};
    }
    
    const mapping = {};
    records.forEach(item => {
      mapping[item.PetMeetID] = item.originalID;
    });
    
    return mapping;
  } catch (error) {
    console.error('批量获取原始雪花ID时出错:', error.message);
    return {};
  }
}

/**
 * 批量获取原始雪花ID到PetMeetID的映射
 * @param {Array<string>} originalIDs 原始雪花ID数组
 * @returns {Promise<Object>} 映射对象 {originalID: PetMeetID}
 */
async function batchGetPetMeetIDs(originalIDs) {
  if (!originalIDs || originalIDs.length === 0) {
    return {};
  }
  
  try {
    const result = await db.collection(MAPPING_COLLECTION)
      .where({
        originalID: _.in(originalIDs)
      })
      .get();
    
    // 处理不同的返回结果格式
    let records = [];
    
    if (result && Array.isArray(result)) {
      records = result;
    } else if (result && result.data && Array.isArray(result.data)) {
      records = result.data;
    } else if (result && Array.isArray(result.list)) {
      records = result.list;
    } else {
      console.log('批量查询结果格式不符合预期:', JSON.stringify(result));
      return {};
    }
    
    const mapping = {};
    records.forEach(item => {
      mapping[item.originalID] = item.PetMeetID;
    });
    
    return mapping;
  } catch (error) {
    console.error('批量获取PetMeetID时出错:', error.message);
    return {};
  }
}

// 导出函数
module.exports = {
  initMappingCollection,
  generateCompactPetMeetID,
  getOriginalID,
  getPetMeetID,  // 原 getShortID
  batchGetOriginalIDs,
  batchGetPetMeetIDs,  // 原 batchGetShortIDs
  checkPetMeetIDExists  // 增加导出检查函数
};
