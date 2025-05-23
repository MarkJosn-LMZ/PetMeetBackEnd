const { getDatabase } = require('../config/cloudbaseConfig');

// 初始化云开发SDK
const db = getDatabase();
const _ = db.command;

// 辅助函数：通过PetMeetID获取宠物ID
async function getpet_idByMeetId(PetMeetID, openid) {
  try {
    const result = await db.collection('pets')
      .where({
        _openid: openid,
        PetMeetID: PetMeetID
      })
      .field({ _id: 1 })
      .get();
    
    if (result.data && result.data.length > 0) {
      return result.data[0]._id;
    }
    return null;
  } catch (error) {
    console.error('通过PetMeetID获取宠物ID失败:', error);
    return null;
  }
}

// 获取特定宠物的日常提醒（喂食、运动等）
exports.getDailyReminders = async (req, res) => {
  try {
    const { pet_id } = req.params;
    const openid = req.user.openid;
    const PetMeetID = req.user.PetMeetID;

    if (!pet_id) {
      return res.status(400).json({ success: false, message: '缺少宠物ID参数' });
    }

    // 构建查询条件
    const queryCondition = {
      pet_id: pet_id,
      relay: 'daily'
    };
    
    // 优先使用PetMeetID查询，如果没有则使用openid
    if (PetMeetID) {
      queryCondition.PetMeetID = PetMeetID;
    } else {
      queryCondition._openid = openid;
    }

    // 获取日常提醒（relay为daily）
    const result = await db.collection('ai_reminder')
      .where(queryCondition)
      .orderBy('time', 'asc')
      .get();

    console.log(`已获取${result.data?.length || 0}条日常提醒`);
    
    // 返回扁平化的数据结构，所有字段在顶层
    const reminders = (result.data || []).map(item => ({
      ...item
    }));
    
    return res.status(200).json({
      success: true,
      message: '获取日常提醒成功',
      ...(reminders.length > 0 ? { reminders } : {})
    });
  } catch (error) {
    console.error('获取日常提醒失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取日常提醒失败',
      error: error.message
    });
  }
};

// 获取特定宠物的健康助手提醒（疫苗、驱虫、体检等）
exports.getHealthAssistantReminders = async (req, res) => {
  try {
    const { pet_id } = req.params;
    const openid = req.user.openid;
    const PetMeetID = req.user.PetMeetID;

    if (!pet_id) {
      return res.status(400).json({ success: false, message: '缺少宠物ID参数' });
    }

    // 构建查询条件
    const queryCondition = {
      pet_id: pet_id,
      relay: 'healthAssistant'
    };
    
    // 优先使用PetMeetID查询，如果没有则使用openid
    if (PetMeetID) {
      queryCondition.PetMeetID = PetMeetID;
    } else {
      queryCondition._openid = openid;
    }

    // 获取健康助手提醒（relay为healthAssistant）
    const result = await db.collection('ai_reminder')
      .where(queryCondition)
      .orderBy('time', 'asc')
      .get();

    console.log(`已获取${result.data?.length || 0}条健康助手提醒`);
    
    // 返回扁平化的数据结构，所有字段在顶层
    const reminders = (result.data || []).map(item => ({
      ...item
    }));
    
    return res.status(200).json({
      success: true,
      message: '获取健康助手提醒成功',
      ...(reminders.length > 0 ? { reminders } : {})
    });
  } catch (error) {
    console.error('获取健康助手提醒失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取健康助手提醒失败',
      error: error.message
    });
  }
};

// 添加提醒
exports.addReminder = async (req, res) => {
  try {
    const reminderData = req.body;
    const openid = req.user.openid;
    const PetMeetID = req.user.PetMeetID;

    // 验证必要字段
    if (!reminderData || !reminderData.pet_id || !reminderData.relay || !reminderData.name || !reminderData.time || !reminderData.type) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要字段 (pet_id, relay, name, time, type)' 
      });
    }

    // 准备要插入数据库的数据
    const dataToSave = {
      _openid: openid,
      pet_id: reminderData.pet_id,
      relay: reminderData.relay, // 'daily' 或 'healthAssistant'
      name: reminderData.name,
      type: reminderData.type,
      time: reminderData.time,
      repeat: reminderData.repeat || '不重复', // 默认值
      important: reminderData.important || '一般', // 默认值
      note: reminderData.note || '', // 默认值
      // 添加PetMeetID支持
      PetMeetID: PetMeetID,
      // 添加创建和更新时间戳
      created_at: new Date(),
      updated_at: new Date()
    };

    // 添加到数据库
    const result = await db.collection('ai_reminder').add(dataToSave);

    console.log('提醒添加成功:', result);
    
    // 获取添加后的完整记录
    const addedRecord = await db.collection('ai_reminder').doc(result.id).get();
    
    if (!addedRecord.data || addedRecord.data.length === 0) {
      // 如果无法获取记录，使用已经准备好的数据
      return res.status(201).json({
        success: true,
        message: '提醒添加成功',
        ...dataToSave,
        _id: result.id
      });
    }
    
    // 返回扁平化的数据结构，所有字段在顶层
    return res.status(201).json({
      success: true,
      message: '提醒添加成功',
      ...addedRecord.data[0],
      _id: result.id
    });
    
  // 已经在上面返回了响应
  } catch (error) {
    console.error('添加提醒失败:', error);
    return res.status(500).json({
      success: false,
      message: '添加提醒失败',
      error: error.message
    });
  }
};

// 更新提醒
exports.updateReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const updateData = req.body;
    const openid = req.user.openid;
    const PetMeetID = req.user.PetMeetID;

    // 检查是否有提醒ID
    if (!reminderId) {
      return res.status(400).json({ success: false, message: '缺少提醒ID' });
    }

    // 检查提醒是否存在并属于当前用户
    const reminder = await db.collection('ai_reminder').doc(reminderId).get();
    
    // 检查权限：用户必须拥有该提醒才能修改
    // 优先检查PetMeetID，如果不匹配则检查openid
    const hasPermission = 
      (PetMeetID && reminder.data[0].PetMeetID === PetMeetID) || 
      reminder.data[0]._openid === openid;
      
    if (!reminder.data.length || !hasPermission) {
      return res.status(404).json({ success: false, message: '提醒不存在或无权限修改' });
    }

    // 准备更新数据
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date()
    };
    
    // 确保PetMeetID在更新中被保留
    if (PetMeetID && !dataToUpdate.PetMeetID) {
      dataToUpdate.PetMeetID = PetMeetID;
    }
    
    delete dataToUpdate._id; // 删除_id字段，避免更新出错

    // 更新数据库
    await db.collection('ai_reminder').doc(reminderId).update({
      data: dataToUpdate
    });

    // 获取更新后的记录
    const updatedRecord = await db.collection('ai_reminder').doc(reminderId).get();
    
    console.log('提醒更新成功:', reminderId);
    
    if (!updatedRecord.data || updatedRecord.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到更新后的提醒'
      });
    }
    
    // 返回扁平化的数据结构，所有字段在顶层
    const updatedReminderData = {
      ...updatedRecord.data[0],
      _id: reminderId
    };
    
    return res.status(200).json({
      success: true,
      message: '提醒更新成功',
      ...updatedReminderData
    });
  } catch (error) {
    console.error('更新提醒失败:', error);
    return res.status(500).json({
      success: false,
      message: '更新提醒失败',
      error: error.message
    });
  }
};

// 删除提醒
exports.deleteReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const openid = req.user.openid;
    const PetMeetID = req.user.PetMeetID;

    // 检查是否有提醒ID
    if (!reminderId) {
      return res.status(400).json({ success: false, message: '缺少提醒ID' });
    }

    // 检查提醒是否存在并属于当前用户
    const reminder = await db.collection('ai_reminder').doc(reminderId).get();
    
    // 检查权限：用户必须拥有该提醒才能删除
    // 优先检查PetMeetID，如果不匹配则检查openid
    const hasPermission = 
      (PetMeetID && reminder.data[0].PetMeetID === PetMeetID) || 
      reminder.data[0]._openid === openid;
      
    if (!reminder.data.length || !hasPermission) {
      return res.status(404).json({ success: false, message: '提醒不存在或无权限删除' });
    }

    // 从数据库删除
    const result = await db.collection('ai_reminder').doc(reminderId).remove();
    
    console.log('提醒删除成功:', result);
    
    return res.status(200).json({
      success: true,
      message: '提醒删除成功',
      _id: reminderId
    });
  } catch (error) {
    console.error('删除提醒失败:', error);
    return res.status(500).json({
      success: false,
      message: '删除提醒失败',
      error: error.message
    });
  }
};
