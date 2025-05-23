// 清空ID映射表
require('dotenv').config();

const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

const MAPPING_COLLECTION = 'id_mappings';

async function clearMappings() {
  try {
    console.log('开始清空ID映射表...');
    
    try {
      // 获取集合中的所有文档
      const result = await db.collection(MAPPING_COLLECTION).get();
      
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
        return;
      }
      
      if (records.length === 0) {
        console.log('映射表为空，无需清理');
        return;
      }
      
      console.log(`找到 ${records.length} 条记录，开始清理...`);
      
      // 删除所有记录
      for (const record of records) {
        await db.collection(MAPPING_COLLECTION).doc(record._id).remove();
        console.log(`已删除记录: ${record._id}`);
      }
      
      console.log('映射表清理完成！');
    } catch (error) {
      console.error('清理过程中出错:', error.message);
    }
  } catch (error) {
    console.error('清空映射表失败:', error);
  }
}

// 执行清空操作
clearMappings().then(() => {
  console.log('操作完成');
  process.exit(0);
}).catch(err => {
  console.error('操作失败:', err);
  process.exit(1);
});
