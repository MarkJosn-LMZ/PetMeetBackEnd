/**
 * 移除用户数据中多余的_openidPetMeetID字段
 * 仅保留PetMeetID字段
 */
require('dotenv').config();
const { getDatabase } = require('../config/cloudbaseConfig');

// 初始化数据库连接
const db = getDatabase();
const _ = db.command;

// 需要清理的集合及其字段映射
const COLLECTIONS_TO_CLEAN = [
  // 用户基础数据
  'ai_user',
  'user_profile',
  'user_membership',
  'user_level',
  'user_settings',
  
  // 社交相关
  'ai_post',
  'ai_comment',
  'ai_like',
  'ai_favorite',
  'ai_follow',
  'ai_breeding',
  
  // 宠物相关
  'ai_pet',
  'pet_exercise_trend',
  'pet_weight_trend',
  'ai_scale_test',
  'ai_vaccine',
  'ai_deworming',
  'ai_reminder',
  'ai_diet_record',
  'ai_exercise_record',
  'ai_examination',
  'ai_pet_health',
  
  // 其他用户相关
  'user_feedback',
  'user_coupons',
  'payment_orders',
  'pets',
  'messages',
  
  // 内容相关
  'videos',
  'topics',
  'tag_keywords',
  'tag_categories',
  
  // 系统相关
  'system_cache',
  'geo_cities',
  'geo_provinces',
  'connection_test'
];

/**
 * 移除集合中的多余字段
 * @param {String} collectionName 集合名称
 */
async function removeRedundantField(collectionName) {
  console.log(`开始处理集合 ${collectionName}...`);
  
  // 查找拥有_openidPetMeetID字段的记录
  const collection = db.collection(collectionName);
  const query = {
    _openidPetMeetID: _.exists(true)
  };
  
  try {
    // 查询符合条件的记录
    const { total } = await collection.where(query).count();
    
    if (total === 0) {
      console.log(`集合 ${collectionName} 中没有包含 _openidPetMeetID 字段的记录`);
      return 0;
    }
    
    console.log(`在集合 ${collectionName} 中找到 ${total} 条记录包含 _openidPetMeetID 字段`);
    
    // 分批处理
    const batchSize = 100;
    let processedCount = 0;
    
    for (let i = 0; i < total; i += batchSize) {
      const { data: records } = await collection
        .where(query)
        .limit(batchSize)
        .get();
      
      // 批量处理记录
      for (const record of records) {
        try {
          await collection.doc(record._id).update({
            _openidPetMeetID: _.remove()
          });
          processedCount++;
          
          if (processedCount % 10 === 0 || processedCount === total) {
            console.log(`已处理 ${processedCount}/${total} 条记录`);
          }
        } catch (error) {
          console.error(`更新记录 ${record._id} 时出错:`, error.message);
        }
      }
    }
    
    console.log(`集合 ${collectionName} 处理完成，共移除了 ${processedCount} 条记录中的 _openidPetMeetID 字段`);
    return processedCount;
  } catch (error) {
    console.error(`处理集合 ${collectionName} 时出错:`, error.message);
    return 0;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('====================================');
  console.log('开始清理多余的 _openidPetMeetID 字段');
  console.log('====================================');
  
  const startTime = Date.now();
  let totalProcessed = 0;
  
  // 处理每个集合
  for (const collectionName of COLLECTIONS_TO_CLEAN) {
    const processed = await removeRedundantField(collectionName);
    totalProcessed += processed;
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log('====================================');
  console.log('清理完成!');
  console.log(`总计处理了 ${COLLECTIONS_TO_CLEAN.length} 个集合`);
  console.log(`共移除了 ${totalProcessed} 条记录中的 _openidPetMeetID 字段`);
  console.log(`总耗时: ${duration.toFixed(2)} 秒`);
  console.log('====================================');
}

// 执行主函数
main()
  .then(() => {
    console.log('脚本执行完毕');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行出错:', error);
    process.exit(1);
  });
