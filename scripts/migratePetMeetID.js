// 加载.env文件中的环境变量
require('dotenv').config();

const { getDatabase } = require('../config/cloudbaseConfig');
const { instance: snowflake, generate: generateSnowflakeId } = require('../utils/snowflake');
const { 
  initMappingCollection,
  generateCompactPetMeetID,
  getOriginalID,
  getShortID,
  batchGetOriginalIDs 
} = require('../utils/idMapping');
const db = getDatabase();
const _ = db.command;

// 输出环境信息
console.log(`CloudBase环境ID: ${process.env.CLOUDBASE_ENV_ID}`);
console.log(`正在使用CloudBase SDK连接数据库...`);

// 需要更新PetMeetID的集合配置
const COLLECTIONS = [
  // 用户基础数据
  { name: 'ai_user', idField: '_id', refField: '_id' },
  { name: 'user_profile', idField: '_openid', refField: '_id' },
  { name: 'user_membership', idField: '_openid', refField: '_id' },
  { name: 'user_level', idField: '_openid', refField: '_id' },
  { name: 'user_settings', idField: '_openid', refField: '_id' },
  
  // 社交相关
  { name: 'ai_post', idField: '_openid', refField: '_id' },
  { name: 'ai_comment', idField: '_openid', refField: '_id' },
  { name: 'ai_like', idField: '_openid', refField: '_id' },
  { name: 'ai_favorite', idField: '_openid', refField: '_id' },
  { name: 'ai_follow', idField: 'followerOpenid', refField: '_id' },
  { name: 'ai_breeding', idField: '_openid', refField: '_id' },
  
  // 宠物相关
  { name: 'ai_pet', idField: 'ownerId', refField: '_id' },
  { name: 'pet_exercise_trend', idField: 'userId', refField: '_id' },
  { name: 'pet_weight_trend', idField: 'userId', refField: '_id' },
  { name: 'ai_scale_test', idField: 'userId', refField: '_id' },
  { name: 'ai_vaccine', idField: 'userId', refField: '_id' },
  { name: 'ai_deworming', idField: 'userId', refField: '_id' },
  { name: 'ai_reminder', idField: 'userId', refField: '_id' },
  { name: 'ai_diet_record', idField: 'userId', refField: '_id' },
  { name: 'ai_exercise_record', idField: 'userId', refField: '_id' },
  { name: 'ai_examination', idField: 'userId', refField: '_id' },
  { name: 'ai_pet_health', idField: 'userId', refField: '_id' },
  
  // 其他用户相关
  { name: 'user_feedback', idField: 'userId', refField: '_id' },
  { name: 'user_coupons', idField: 'userId', refField: '_id' },
  { name: 'payment_orders', idField: 'userId', refField: '_id' },
  { name: 'pets', idField: 'ownerId', refField: '_id' },
  { name: 'messages', idField: ['senderId', 'receiverId'], refField: '_id' },
  
  // 内容相关
  { name: 'videos', idField: 'userId', refField: '_id' },
  { name: 'topics', idField: 'creatorId', refField: '_id' },
  { name: 'tag_keywords', idField: 'creatorId', refField: '_id' },
  { name: 'tag_categories', idField: 'creatorId', refField: '_id' },
  
  // 系统相关
  { name: 'system_cache', idField: 'userId', refField: '_id' },
  { name: 'geo_cities', idField: 'creatorId', refField: '_id' },
  { name: 'geo_provinces', idField: 'creatorId', refField: '_id' },
  { name: 'connection_test', idField: 'userId', refField: '_id' }
];

/**
 * 生成唯一的PetMeetID（使用映射表9位短码）
 * @param {string} userId 用户ID（openID）
 * @returns {Promise<string>} 9位数字ID
 */
async function generatePetMeetID(userId) {
  return await generateCompactPetMeetID(userId);
}

/**
 * 检查PetMeetID是否已存在
 * @param {String} PetMeetID 要检查的PetMeetID
 * @returns {Promise<Boolean>} 是否存在
 */
async function checkPetMeetIDExists(PetMeetID) {
  // 由于雪花ID是唯一的，理论上不会重复
  // 但为了健壮性，仍然保留检查
  const { data } = await db.collection('ai_user')
    .where({
      PetMeetID: _.eq(PetMeetID)
    })
    .count();
  
  return data.total > 0;
};

/**
 * 获取用户的PetMeetID，如果不存在则生成一个新的
 * @param {string} userId 用户ID（openID）
 * @returns {Promise<string>} PetMeetID
 */
const getOrCreatePetMeetID = async (userId) => {
  // 1. 查找已存在的记录
  const userCollection = db.collection('ai_user');
  const result = await userCollection.doc(userId).get();
  
  let userData;
  if (result && result.data) {
    userData = result.data;
  } else {
    console.log(`用户 ${userId} 数据不存在`);
    userData = null;
  }
  
  if (userData && userData.PetMeetID) {
    console.log(`用户 ${userId} 已有PetMeetID: ${userData.PetMeetID}`);
    return userData.PetMeetID;
  }
  
  // 2. 生成新的PetMeetID
  const PetMeetID = await generatePetMeetID(userId);
  console.log(`为用户 ${userId} 生成了新的PetMeetID: ${PetMeetID}`);
  
  // 3. 更新用户记录
  try {
    await db.collection('ai_user').doc(userId).update({
      PetMeetID: PetMeetID,
      updatedAt: db.serverDate()
    });
    console.log(`用户 ${userId} 的PetMeetID已更新为 ${PetMeetID}`);
  } catch (error) {
    console.error(`更新用户 ${userId} 的PetMeetID时出错:`, error.message);
  }
  
  return PetMeetID;
};

/**
 * 更新集合中的用户引用
 */
const updateCollectionReferences = async (collectionName, idField, refField, PetMeetID, userId) => {
  try {
    // 处理多字段情况
    const idFields = Array.isArray(idField) ? idField : [idField];
    let totalUpdated = 0;
    
    // 对每个ID字段单独处理
    for (const field of idFields) {
      try {
        // 构建查询条件
        const query = {};
        query[field] = _.eq(userId);
        
        // 查找所有引用该用户的记录
        console.log(`查询集合 ${collectionName} 中 ${field} = ${userId} 的记录...`);
        const result = await db.collection(collectionName)
          .where(query)
          .get();
        
        // 处理不同格式的查询结果
        let records = [];
        
        if (result && Array.isArray(result)) {
          records = result;
        } else if (result && result.data && Array.isArray(result.data)) {
          records = result.data;
        } else if (result && Array.isArray(result.list)) {
          records = result.list;
        } else {
          console.log(`查询结果格式不符合预期:`, JSON.stringify(result));
          console.log(`尝试解析查询结果:`, result);
          // 尝试其他可能的属性
          if (result && result.result && Array.isArray(result.result.data)) {
            records = result.result.data;
          } else if (result && result.docs && Array.isArray(result.docs)) {
            records = result.docs;
          } else {
            console.log(`无法解析查询结果，跳过集合 ${collectionName}`);
            continue; // 跳过当前字段
          }
        }
        
        if (!records || records.length === 0) {
          console.log(`在 ${collectionName} 中未找到 ${field} 为 ${userId} 的记录`);
          continue;
        }
        
        console.log(`在 ${collectionName} 中找到 ${records.length} 条 ${field} 为 ${userId} 的记录`);
        
        // 单条更新，避开批量操作可能的问题
        let updatedCount = 0;
        
        for (const record of records) {
          try {
            // 跳过已有PetMeetID的记录
            if (record.PetMeetID) {
              console.log(`记录 ${record._id} 已有PetMeetID，跳过`);
              continue;
            }
            
            // 构建更新数据
            const updateData = {
              updatedAt: db.serverDate()
            };
            
            // 为当前字段添加PetMeetID
            const PetMeetIDField = `${field.replace(/Id$/, '')}PetMeetID`;
            updateData[PetMeetIDField] = PetMeetID;
            
            // 如果是主用户ID，则同时更新PetMeetID字段
            if (field === '_openid' || field === 'userId' || field === 'ownerId' || field === 'creatorId') {
              updateData.PetMeetID = PetMeetID;
            }
            
            const docId = record[refField] || record._id;
            console.log(`更新记录 ${docId}...`);
            await db.collection(collectionName).doc(docId).update(updateData);
            console.log(`记录 ${docId} 更新成功`);
            
            updatedCount++;
          } catch (recordError) {
            console.error(`更新记录 ${record._id} 时出错:`, recordError.message);
            // 继续处理下一条记录
          }
        }
        
        console.log(`已更新 ${collectionName} 中 ${field} 为 ${userId} 的 ${updatedCount} 条记录`);
        totalUpdated += updatedCount;
      } catch (fieldError) {
        console.error(`处理字段 ${field} 时出错:`, fieldError.message);
        // 继续处理下一个字段
      }
    }
    
    return totalUpdated;
  } catch (error) {
    console.error(`更新 ${collectionName} 时出错:`, error);
    return 0;
  }
};

/**
 * 为现有用户生成唯一的PetMeetID并更新所有相关集合
 */
const migratePetMeetID = async () => {
  const startTime = Date.now();
  let processedUsers = 0;
  let totalUpdated = 0;
  let errorUsers = [];
  
  try {
    console.log('================================================================================');
    console.log('开始为现有用户生成并更新PetMeetID（9位短码+雪花ID映射表）...');
    
    // 初始化映射表集合
    console.log('初始化ID映射表...');
    await initMappingCollection();
    console.log('映射表初始化完成，已更新为新格式（包含用户ID和PetMeetID字段）');
    console.log('='.repeat(80));
    
    // 1. 查找所有用户
    const { data: users } = await db.collection('ai_user').get();
    console.log(`\n共找到 ${users.length} 个用户`);
    
    // 2. 为每个用户处理PetMeetID
    for (const [index, user] of users.entries()) {
      const userStartTime = Date.now();
      const userLogPrefix = `[用户 ${index + 1}/${users.length}] ${user._id}`;
      
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${userLogPrefix} 开始处理...`);
        
        // 获取或生成PetMeetID
        const PetMeetID = await getOrCreatePetMeetID(user._id);
        
        // 3. 更新所有相关集合
        for (const collection of COLLECTIONS) {
          if (collection.name === 'ai_user') continue; // 已经处理过
          
          const collectionStartTime = Date.now();
          console.log(`\n${userLogPrefix} 更新集合 ${collection.name}...`);
          
          try {
            const updated = await updateCollectionReferences(
              collection.name,
              collection.idField,
              collection.refField,
              PetMeetID,
              user._id
            );
            
            totalUpdated += updated;
            console.log(`${userLogPrefix} 更新 ${collection.name} 完成，更新了 ${updated} 条记录，耗时 ${Date.now() - collectionStartTime}ms`);
          } catch (error) {
            console.error(`${userLogPrefix} 更新 ${collection.name} 时出错:`, error.message);
            // 记录错误但继续处理其他集合
          }
        }
        
        processedUsers++;
        console.log(`\n${userLogPrefix} 处理完成，总耗时 ${Date.now() - userStartTime}ms`);
      } catch (error) {
        console.error(`\n${userLogPrefix} 处理失败:`, error.message);
        errorUsers.push({
          userId: user._id,
          error: error.message
        });
      }
      
      // 每处理10个用户输出一次进度
      if ((index + 1) % 10 === 0 || (index + 1) === users.length) {
        const progress = ((index + 1) / users.length * 100).toFixed(2);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`进度: ${index + 1}/${users.length} (${progress}%)`);
        console.log(`已成功处理: ${processedUsers} 个用户`);
        console.log(`失败用户数: ${errorUsers.length}`);
        console.log(`已更新记录总数: ${totalUpdated}`);
        console.log(`已运行时间: ${Math.round((Date.now() - startTime) / 1000)} 秒`);
        console.log('='.repeat(60));
      }
    }
    
    // 4. 输出汇总信息
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + '='.repeat(80));
    console.log('PetMeetID 迁移完成！');
    console.log('='.repeat(80));
    console.log(`总用户数: ${users.length}`);
    console.log(`成功处理: ${processedUsers} 个用户`);
    console.log(`失败用户: ${errorUsers.length} 个`);
    console.log(`更新记录总数: ${totalUpdated} 条`);
    console.log(`总耗时: ${Math.floor(totalTime / 60)} 分 ${totalTime % 60} 秒`);
    
    if (errorUsers.length > 0) {
      console.log('\n失败用户列表:');
      errorUsers.forEach((err, idx) => {
        console.log(`${idx + 1}. 用户ID: ${err.userId}`);
        console.log(`   错误: ${err.error}`);
      });
    }
    
    console.log('\n迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n迁移过程中发生致命错误:', error);
    process.exit(1);
  }
};

// 执行迁移
migratePetMeetID();
