const { getDatabase } = require('../config/cloudbaseConfig');

const db = getDatabase();
const _ = db.command;

// 定义集合名称
const WEIGHT_COLLECTION = 'ai_weight_record';
const DIET_COLLECTION = 'ai_diet_record';
const EXERCISE_COLLECTION = 'ai_exercise_record';

// 体重记录相关控制器方法
exports.getWeightRecords = async (req, res) => {
  try {
    const { pet_id, PetMeetID, startDate, endDate, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;
    
    // 构建查询条件
    let query = { userId };
    
    // 支持通过pet_id或PetMeetID查询
    if (pet_id) query.pet_id = pet_id;
    if (PetMeetID) query.PetMeetID = PetMeetID;
    
    // 支持日期范围查询
    if (startDate || endDate) {
      if (startDate) query.recordDate = _.gte(new Date(startDate));
      if (endDate) query.recordDate = _.lte(new Date(endDate));
      // 如果同时有开始和结束日期，使用and条件
      if (startDate && endDate) {
        query.recordDate = _.and(_.gte(new Date(startDate)), _.lte(new Date(endDate)));
      }
    }
    
    console.log('[健康控制器] 查询体重记录:', JSON.stringify(query));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用CloudBase SDK查询数据
    const { total } = await db.collection(WEIGHT_COLLECTION).where(query).count();
    
    // 获取记录列表
    const { data: records } = await db.collection(WEIGHT_COLLECTION)
      .where(query)
      .orderBy('recordDate', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取体重记录失败:', error);
    res.status(500).json({ success: false, message: '获取体重记录失败', error: error.message });
  }
};

exports.getWeightRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 使用CloudBase SDK查询数据
    const { data } = await db.collection(WEIGHT_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '体重记录不存在' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('获取体重记录详情失败:', error);
    res.status(500).json({ success: false, message: '获取体重记录详情失败', error: error.message });
  }
};

exports.createWeightRecord = async (req, res) => {
  try {
    const { weight, unit, bodyType, pet_id, PetMeetID, recordDate, description } = req.body;
    const userId = req.user._id;
    
    if (!weight || !pet_id) {
      return res.status(400).json({ success: false, message: '体重和宠物ID为必填项' });
    }
    
    // 构建记录数据
    const newRecord = {
      weight,
      unit: unit || 'kg',
      bodyType: bodyType || '标准',
      pet_id,
      PetMeetID: PetMeetID || '',
      recordDate: recordDate ? new Date(recordDate) : db.serverDate(),
      description: description || '',
      userId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('[健康控制器] 创建体重记录:', JSON.stringify(newRecord));
    
    // 使用CloudBase SDK添加数据
    const { id } = await db.collection(WEIGHT_COLLECTION).add(newRecord);
    
    // 添加ID到返回数据中
    newRecord._id = id;
    
    res.status(201).json({ success: true, data: newRecord, message: '体重记录创建成功' });
  } catch (error) {
    console.error('创建体重记录失败:', error);
    res.status(500).json({ success: false, message: '创建体重记录失败', error: error.message });
  }
};

exports.updateWeightRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    const { weight, unit, bodyType, recordDate, description } = req.body;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection(WEIGHT_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '体重记录不存在或无权限修改' });
    }
    
    // 构建更新数据
    const updateData = {
      weight, 
      unit, 
      bodyType, 
      recordDate: recordDate ? new Date(recordDate) : data[0].recordDate,
      description,
      updatedAt: db.serverDate()
    };
    
    // 执行更新操作
    await db.collection(WEIGHT_COLLECTION).doc(recordId).update(updateData);
    
    // 返回更新后的完整记录
    const { data: updatedRecord } = await db.collection(WEIGHT_COLLECTION).doc(recordId).get();
    
    res.json({ success: true, data: updatedRecord, message: '体重记录更新成功' });
  } catch (error) {
    console.error('更新体重记录失败:', error);
    res.status(500).json({ success: false, message: '更新体重记录失败', error: error.message });
  }
};

exports.deleteWeightRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection(WEIGHT_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '体重记录不存在或无权限删除' });
    }
    
    // 执行删除操作
    await db.collection(WEIGHT_COLLECTION).doc(recordId).remove();
    
    res.json({ success: true, message: '体重记录删除成功' });
  } catch (error) {
    console.error('删除体重记录失败:', error);
    res.status(500).json({ success: false, message: '删除体重记录失败', error: error.message });
  }
};

// 饮食记录相关控制器方法
exports.getDietRecords = async (req, res) => {
  try {
    const { pet_id, PetMeetID, startDate, endDate, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;
    
    // 构建查询条件
    let query = { userId };
    
    // 支持通过pet_id或PetMeetID查询
    if (pet_id) query.pet_id = pet_id;
    if (PetMeetID) query.PetMeetID = PetMeetID;
    
    // 支持日期范围查询
    if (startDate || endDate) {
      if (startDate) query.recordDate = _.gte(new Date(startDate));
      if (endDate) query.recordDate = _.lte(new Date(endDate));
      // 如果同时有开始和结束日期，使用and条件
      if (startDate && endDate) {
        query.recordDate = _.and(_.gte(new Date(startDate)), _.lte(new Date(endDate)));
      }
    }
    
    console.log('[健康控制器] 查询饮食记录:', JSON.stringify(query));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用CloudBase SDK查询数据
    const { total } = await db.collection(DIET_COLLECTION).where(query).count();
    
    // 获取记录列表
    const { data: records } = await db.collection(DIET_COLLECTION)
      .where(query)
      .orderBy('recordDate', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取饮食记录失败:', error);
    res.status(500).json({ success: false, message: '获取饮食记录失败', error: error.message });
  }
};

exports.getDietRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 使用CloudBase SDK查询数据
    const { data } = await db.collection(DIET_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '饮食记录不存在' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('获取饮食记录详情失败:', error);
    res.status(500).json({ success: false, message: '获取饮食记录详情失败', error: error.message });
  }
};

exports.createDietRecord = async (req, res) => {
  try {
    const { 
      foodType, foodName, amount, unit, waterAmount, waterUnit, 
      pet_id, PetMeetID, recordDate, location, note 
    } = req.body;
    const userId = req.user._id;
    
    if (!foodType || !foodName || !pet_id) {
      return res.status(400).json({ success: false, message: '食物类型、名称和宠物ID为必填项' });
    }
    
    // 构建记录数据
    const newRecord = {
      foodType,
      foodName,
      amount: amount || 0,
      unit: unit || 'g',
      waterAmount: waterAmount || 0,
      waterUnit: waterUnit || 'ml',
      pet_id,
      PetMeetID: PetMeetID || '',
      recordDate: recordDate ? new Date(recordDate) : db.serverDate(),
      location: location || '',
      note: note || '',
      userId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('[健康控制器] 创建饮食记录:', JSON.stringify(newRecord));
    
    // 使用CloudBase SDK添加数据
    const { id } = await db.collection(DIET_COLLECTION).add(newRecord);
    
    // 添加ID到返回数据中
    newRecord._id = id;
    
    res.status(201).json({ success: true, data: newRecord, message: '饮食记录创建成功' });
  } catch (error) {
    console.error('创建饮食记录失败:', error);
    res.status(500).json({ success: false, message: '创建饮食记录失败', error: error.message });
  }
};

exports.updateDietRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    const { 
      foodType, foodName, amount, unit, waterAmount, waterUnit, 
      recordDate, location, note 
    } = req.body;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection(DIET_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '饮食记录不存在或无权限修改' });
    }
    
    // 构建更新数据
    const updateData = {
      foodType, 
      foodName, 
      amount, 
      unit, 
      waterAmount, 
      waterUnit, 
      recordDate: recordDate ? new Date(recordDate) : data[0].recordDate,
      location: location || data[0].location,
      note,
      updatedAt: db.serverDate()
    };
    
    // 执行更新操作
    await db.collection(DIET_COLLECTION).doc(recordId).update(updateData);
    
    // 返回更新后的完整记录
    const { data: updatedRecord } = await db.collection(DIET_COLLECTION).doc(recordId).get();
    
    res.json({ success: true, data: updatedRecord, message: '饮食记录更新成功' });
  } catch (error) {
    console.error('更新饮食记录失败:', error);
    res.status(500).json({ success: false, message: '更新饮食记录失败', error: error.message });
  }
};

exports.deleteDietRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection(DIET_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '饮食记录不存在或无权限删除' });
    }
    
    // 执行删除操作
    await db.collection(DIET_COLLECTION).doc(recordId).remove();
    
    res.json({ success: true, message: '饮食记录删除成功' });
  } catch (error) {
    console.error('删除饮食记录失败:', error);
    res.status(500).json({ success: false, message: '删除饮食记录失败', error: error.message });
  }
};

// 运动记录相关控制器方法
exports.getExerciseRecords = async (req, res) => {
  try {
    const { pet_id, PetMeetID, startDate, endDate, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;
    
    // 构建查询条件
    let query = { userId };
    
    // 支持通过pet_id或PetMeetID查询
    if (pet_id) query.pet_id = pet_id;
    if (PetMeetID) query.PetMeetID = PetMeetID;
    
    // 支持日期范围查询
    if (startDate || endDate) {
      if (startDate) query.recordDate = _.gte(new Date(startDate));
      if (endDate) query.recordDate = _.lte(new Date(endDate));
      // 如果同时有开始和结束日期，使用and条件
      if (startDate && endDate) {
        query.recordDate = _.and(_.gte(new Date(startDate)), _.lte(new Date(endDate)));
      }
    }
    
    console.log('[健康控制器] 查询运动记录:', JSON.stringify(query));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用CloudBase SDK查询数据
    const { total } = await db.collection(EXERCISE_COLLECTION).where(query).count();
    
    // 获取记录列表
    const { data: records } = await db.collection(EXERCISE_COLLECTION)
      .where(query)
      .orderBy('recordDate', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取运动记录失败:', error);
    res.status(500).json({ success: false, message: '获取运动记录失败', error: error.message });
  }
};

exports.getExerciseRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 使用CloudBase SDK查询数据
    const { data } = await db.collection(EXERCISE_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '运动记录不存在' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('获取运动记录详情失败:', error);
    res.status(500).json({ success: false, message: '获取运动记录详情失败', error: error.message });
  }
};

exports.createExerciseRecord = async (req, res) => {
  try {
    const { 
      exerciseType, duration, intensity, steps, 
      pet_id, PetMeetID, recordDate, location, note 
    } = req.body;
    const userId = req.user._id;
    
    if (!exerciseType || !duration || !pet_id) {
      return res.status(400).json({ success: false, message: '运动类型、时长和宠物ID为必填项' });
    }
    
    // 构建记录数据
    const newRecord = {
      exerciseType,
      duration,
      intensity: intensity || '中等',
      steps: steps || 0,
      pet_id,
      PetMeetID: PetMeetID || '',
      recordDate: recordDate ? new Date(recordDate) : db.serverDate(),
      location: location || '',
      note: note || '',
      userId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    
    console.log('[健康控制器] 创建运动记录:', JSON.stringify(newRecord));
    
    // 使用CloudBase SDK添加数据
    const { id } = await db.collection(EXERCISE_COLLECTION).add(newRecord);
    
    // 添加ID到返回数据中
    newRecord._id = id;
    
    res.status(201).json({ success: true, data: newRecord, message: '运动记录创建成功' });
  } catch (error) {
    console.error('创建运动记录失败:', error);
    res.status(500).json({ success: false, message: '创建运动记录失败', error: error.message });
  }
};

exports.updateExerciseRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    const { 
      exerciseType, duration, intensity, steps, 
      recordDate, location, note 
    } = req.body;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection(EXERCISE_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '运动记录不存在或无权限修改' });
    }
    
    // 构建更新数据
    const updateData = {
      exerciseType, 
      duration, 
      intensity, 
      steps, 
      recordDate: recordDate ? new Date(recordDate) : data[0].recordDate,
      location: location || data[0].location,
      note,
      updatedAt: db.serverDate()
    };
    
    // 执行更新操作
    await db.collection(EXERCISE_COLLECTION).doc(recordId).update(updateData);
    
    // 返回更新后的完整记录
    const { data: updatedRecord } = await db.collection(EXERCISE_COLLECTION).doc(recordId).get();
    
    res.json({ success: true, data: updatedRecord, message: '运动记录更新成功' });
  } catch (error) {
    console.error('更新运动记录失败:', error);
    res.status(500).json({ success: false, message: '更新运动记录失败', error: error.message });
  }
};

exports.deleteExerciseRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection(EXERCISE_COLLECTION)
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '运动记录不存在或无权限删除' });
    }
    
    // 执行删除操作
    await db.collection(EXERCISE_COLLECTION).doc(recordId).remove();
    
    res.json({ success: true, message: '运动记录删除成功' });
  } catch (error) {
    console.error('删除运动记录失败:', error);
    res.status(500).json({ success: false, message: '删除运动记录失败', error: error.message });
  }
};

// 获取宠物健康汇总数据
exports.getPetHealthSummary = async (req, res) => {
  try {
    const { pet_id } = req.params;
    const { PetMeetID } = req.query;
    const userId = req.user._id;
    
    console.log(`[健康控制器] 获取宠物健康汇总数据: pet_id=${pet_id}, PetMeetID=${PetMeetID}`);
    
    // 构建查询条件
    let query = { userId };
    if (PetMeetID) {
      query.PetMeetID = PetMeetID;
    } else if (pet_id) {
      query.pet_id = pet_id;
    } else {
      return res.status(400).json({ success: false, message: '缺少宠物ID或PetMeetID' });
    }
    
    // 获取近期日期范围
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log(`[健康控制器] 查询日期范围: ${thirtyDaysAgo.toISOString()} - ${today.toISOString()}`);
    console.log(`[健康控制器] 今日开始: ${todayStart.toISOString()}`);
    
    // 使用CloudBase SDK进行并行查询
    const [weightResult, dietResult, exerciseResult, vaccineResult, dewormingResult, examinationResult] = await Promise.all([
      // 查询最近30天的体重记录
      db.collection(WEIGHT_COLLECTION)
        .where({
          ...query,
          recordDate: _.gte(thirtyDaysAgo)
        })
        .orderBy('recordDate', 'desc')
        .limit(30)
        .get(),
      
      // 查询今天的饮食记录
      db.collection(DIET_COLLECTION)
        .where({
          ...query,
          recordDate: _.gte(todayStart)
        })
        .orderBy('recordDate', 'desc')
        .get(),
      
      // 查询最近30天的运动记录
      db.collection(EXERCISE_COLLECTION)
        .where({
          ...query,
          recordDate: _.gte(thirtyDaysAgo)
        })
        .orderBy('recordDate', 'desc')
        .limit(30)
        .get(),
        
      // 查询疫苗记录
      db.collection('ai_vaccine')
        .where(query)
        .orderBy('dueDate', 'desc')
        .limit(50)
        .get(),
        
      // 查询驱虫记录
      db.collection('ai_deworming')
        .where(query)
        .orderBy('dueDate', 'desc')
        .limit(50)
        .get(),
        
      // 查询体检记录
      db.collection('ai_examination')
        .where(query)
        .orderBy('dueDate', 'desc')
        .limit(50)
        .get()
    ]);
    
    // 提取查询结果
    const weightRecords = weightResult.data || [];
    const dietRecords = dietResult.data || [];
    const exerciseRecords = exerciseResult.data || [];
    const vaccineRecords = vaccineResult.data || [];
    const dewormingRecords = dewormingResult.data || [];
    const examinationRecords = examinationResult.data || [];
    
    console.log(`[健康控制器] 查询结果: 体重记录(${weightRecords.length}), 饮食记录(${dietRecords.length}), 运动记录(${exerciseRecords.length}), 疫苗记录(${vaccineRecords.length}), 驱虫记录(${dewormingRecords.length}), 体检记录(${examinationRecords.length})`);
    
    // 处理体重趋势数据
    const weightTrend = weightRecords.map(record => {
      const date = new Date(record.recordDate);
      // 使用 iOS 兼容的日期格式 "yyyy/MM/dd"
      const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      return {
        date: formattedDate,
        value: record.weight,
        unit: record.unit,
        bodyType: record.bodyType,
        id: record._id,
        recordDate: record.recordDate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    }).reverse();
    
    // 获取最新体重记录
    const latestWeight = weightRecords.length > 0 ? weightRecords[0] : null;
    
    // 处理饮食记录
    const meals = dietRecords.map(record => {
      const recordDate = new Date(record.recordDate);
      const hours = recordDate.getHours().toString().padStart(2, '0');
      const minutes = recordDate.getMinutes().toString().padStart(2, '0');
      
      return {
        id: record._id,
        type: record.foodType,
        food: `${record.foodName} ${record.amount}${record.unit}`,
        time: `${hours}:${minutes}`,
        waterAmount: record.waterAmount,
        waterUnit: record.waterUnit,
        recordDate: record.recordDate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        amount: record.amount,
        unit: record.unit,
        foodName: record.foodName
      };
    });
    
    // 计算今日总食量和饮水量
    let totalFoodAmount = 0;
    let totalWaterAmount = 0;
    
    dietRecords.forEach(record => {
      totalFoodAmount += record.amount || 0;
      totalWaterAmount += record.waterAmount || 0;
    });
    
    // 处理运动记录
    const exerciseItems = exerciseRecords.map(record => {
      const recordDate = new Date(record.recordDate);
      const hours = recordDate.getHours().toString().padStart(2, '0');
      const minutes = recordDate.getMinutes().toString().padStart(2, '0');
      
      return {
        id: record._id,
        type: record.exerciseType,
        detail: `${record.duration}分钟 (${record.intensity})`,
        time: `${hours}:${minutes}`,
        duration: record.duration,
        intensity: record.intensity,
        steps: record.steps,
        recordDate: record.recordDate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        exerciseType: record.exerciseType
      };
    });
    
    // 计算今日运动时间和步数
    const todayExercises = exerciseRecords.filter(record => {
      const recordDate = new Date(record.recordDate);
      return recordDate.getDate() === today.getDate() && 
             recordDate.getMonth() === today.getMonth() && 
             recordDate.getFullYear() === today.getFullYear();
    });
    
    let todayTotalDuration = 0;
    let todaySteps = 0;
    
    todayExercises.forEach(record => {
      todayTotalDuration += record.duration || 0;
      todaySteps += record.steps || 0;
    });
    
    // 构建运动趋势数据
    const exerciseTrend = [];
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push({
        date: date,
        formattedDate: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
        duration: 0
      });
    }
    
    // 汇总每天的运动时间
    exerciseRecords.forEach(record => {
      const recordDate = new Date(record.recordDate);
      
      last7Days.forEach(day => {
        if (recordDate.getDate() === day.date.getDate() && 
            recordDate.getMonth() === day.date.getMonth() && 
            recordDate.getFullYear() === day.date.getFullYear()) {
          day.duration += record.duration || 0;
        }
      });
    });
    
    // 转换为前端需要的格式，包含数据库字段
    last7Days.forEach(day => {
      // 查找该日期的原始记录，以获取数据库字段
      const dayRecords = exerciseRecords.filter(record => {
        const recordDate = new Date(record.recordDate);
        return recordDate.getDate() === day.date.getDate() && 
               recordDate.getMonth() === day.date.getMonth() && 
               recordDate.getFullYear() === day.date.getFullYear();
      });
      
      // 使用该日期最新的记录的数据库字段，如果没有记录则使用当天日期
      const latestRecord = dayRecords.length > 0 ? dayRecords[dayRecords.length - 1] : null;
      
      // 使用 iOS 兼容的日期格式
      const iosCompatibleDate = `${day.date.getFullYear()}/${String(day.date.getMonth() + 1).padStart(2, '0')}/${String(day.date.getDate()).padStart(2, '0')}`;
      
      exerciseTrend.push({
        date: iosCompatibleDate,
        value: day.duration,
        // 包含数据库字段以支持近3天过滤
        recordDate: latestRecord ? latestRecord.recordDate : day.date.toISOString(),
        createdAt: latestRecord ? latestRecord.createdAt : day.date.toISOString(),
        updatedAt: latestRecord ? latestRecord.updatedAt : day.date.toISOString(),
        // 添加辅助信息
        recordsCount: dayRecords.length
      });
    });
    
    // 处理健康记录数据
    const processHealthRecords = (records) => {
      return records.map(record => {
        const dueDate = new Date(record.dueDate);
        const today = new Date();
        const diffTime = dueDate - today;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status = 'normal';
        if (daysLeft < 0) status = 'expired';
        else if (daysLeft <= 7) status = 'expiring';
        
        return {
          ...record,
          id: record._id,
          daysLeft,
          status
        };
      });
    };
    
    // 处理各类健康记录
    const processedVaccineRecords = processHealthRecords(vaccineRecords);
    const processedDewormingRecords = processHealthRecords(dewormingRecords);
    const processedExaminationRecords = processHealthRecords(examinationRecords);
    
    // 构建响应数据
    const healthData = {
      dailyHealth: {
        weight: {
          value: latestWeight ? latestWeight.weight : 0,
          unit: latestWeight ? latestWeight.unit : 'kg',
          bodyType: latestWeight ? latestWeight.bodyType : '未记录',
          date: latestWeight ? latestWeight.recordDate : null
        },
        weightTrend: {
          yAxis: { 
            min: 0, 
            max: Math.max(10, ...weightTrend.map(item => item.value || 0)) + 2,
            step: 2 
          },
          data: weightTrend
        },
        diet: {
          totalAmount: totalFoodAmount > 0 ? `${totalFoodAmount}g` : '未记录',
          waterAmount: totalWaterAmount > 0 ? `${totalWaterAmount}ml` : '未记录',
          recommend: '食物: 根据体重定制, 饮水: 每天充足饮水',
          meals: meals
        },
        exercise: {
          todayWalking: todayTotalDuration > 0 ? `${todayTotalDuration}分钟` : '未记录',
          steps: todaySteps.toString(),
          recommend: '30-60分钟/天',
          intensity: todayExercises.length > 0 ? todayExercises[0].intensity : '未记录',
          records: exerciseItems,
          trend: {
            yAxis: { 
              min: 0, 
              max: Math.max(60, ...exerciseTrend.map(item => item.value || 0)) + 15,
              step: 15 
            },
            data: exerciseTrend
          }
        }
      },
      healthAssistant: {
        healthStatus: {
          weight: {
            status: latestWeight ? (
              latestWeight.bodyType === '标准' || latestWeight.bodyType === '理想体型' ? '正常' : '需注意'
            ) : '评估中...',
            standardRange: '根据宠物品种和年龄定制',
            detailedBodyType: latestWeight ? latestWeight.bodyType : '未评估'
          },
          food: {
            status: dietRecords.length > 0 ? '正常' : '需记录'
          },
          activity: {
            status: todayTotalDuration >= 30 ? '正常' : '需加强',
            detailedExerciseType: todayExercises.length > 0 ? todayExercises[0].intensity : '未评估'
          },
          overall: {
            score: calculateHealthScore(weightRecords, dietRecords, exerciseRecords, processedVaccineRecords, processedDewormingRecords, processedExaminationRecords),
            value: calculateOverallStatus(weightRecords, dietRecords, exerciseRecords, processedVaccineRecords, processedDewormingRecords, processedExaminationRecords)
          }
        },
        // 添加健康记录数据
        vaccineRecords: processedVaccineRecords,
        dewormingRecords: processedDewormingRecords,
        examinationRecords: processedExaminationRecords
      }
    };
    
    res.json({ success: true, data: healthData });
  } catch (error) {
    console.error('获取宠物健康汇总数据失败:', error);
    res.status(500).json({ success: false, message: '获取宠物健康汇总数据失败', error: error.message });
  }
};

/**
 * 更新健康得分计算，添加疫苗、驱虫、体检记录评估
 * @param {Array} weightRecords 体重记录
 * @param {Array} dietRecords 饮食记录
 * @param {Array} exerciseRecords 运动记录
 * @param {Array} vaccineRecords 疫苗记录
 * @param {Array} dewormingRecords 驱虫记录
 * @param {Array} examinationRecords 体检记录
 * @returns {number} 健康得分
 */
function calculateHealthScore(weightRecords, dietRecords, exerciseRecords, vaccineRecords, dewormingRecords, examinationRecords) {
  let score = 50; // 基础分
  
  // 如果有体重记录
  if (weightRecords.length > 0) {
    const latestWeight = weightRecords[0];
    if (latestWeight.bodyType === '标准' || latestWeight.bodyType === '理想体型') {
      score += 10;
    } else if (latestWeight.bodyType === '偏瘦' || latestWeight.bodyType === '偏胖') {
      score += 5;
    }
  }
  
  // 如果有饮食记录
  if (dietRecords.length > 0) {
    score += Math.min(10, dietRecords.length * 3); // 每条记录3分，最多10分
  }
  
  // 如果有运动记录
  if (exerciseRecords.length > 0) {
    const today = new Date();
    const todayExercises = exerciseRecords.filter(record => {
      const recordDate = new Date(record.recordDate);
      return recordDate.getDate() === today.getDate() && 
             recordDate.getMonth() === today.getMonth() && 
             recordDate.getFullYear() === today.getFullYear();
    });
    
    let todayDuration = 0;
    todayExercises.forEach(record => {
      todayDuration += record.duration || 0;
    });
    
    if (todayDuration >= 60) {
      score += 10;
    } else if (todayDuration >= 30) {
      score += 7;
    } else if (todayDuration > 0) {
      score += 3;
    }
  }
  
  // 疫苗接种状态评估
  if (vaccineRecords.length > 0) {
    const expiredVaccines = vaccineRecords.filter(record => record.status === 'expired').length;
    const expiringVaccines = vaccineRecords.filter(record => record.status === 'expiring').length;
    const normalVaccines = vaccineRecords.filter(record => record.status === 'normal').length;
    
    if (expiredVaccines === 0 && expiringVaccines <= 1) {
      score += 8; // 疫苗状态良好
    } else if (expiredVaccines <= 1) {
      score += 4; // 有少量过期疫苗
    }
  }
  
  // 驱虫状态评估
  if (dewormingRecords.length > 0) {
    const expiredDeworming = dewormingRecords.filter(record => record.status === 'expired').length;
    const expiringDeworming = dewormingRecords.filter(record => record.status === 'expiring').length;
    
    if (expiredDeworming === 0 && expiringDeworming <= 1) {
      score += 6; // 驱虫状态良好
    } else if (expiredDeworming <= 1) {
      score += 3; // 有少量过期驱虫
    }
  }
  
  // 体检状态评估
  if (examinationRecords.length > 0) {
    const expiredExaminations = examinationRecords.filter(record => record.status === 'expired').length;
    const expiringExaminations = examinationRecords.filter(record => record.status === 'expiring').length;
    
    if (expiredExaminations === 0 && expiringExaminations <= 1) {
      score += 6; // 体检状态良好
    } else if (expiredExaminations <= 1) {
      score += 3; // 有少量过期体检
    }
  }
  
  // 限制最高分为100
  return Math.min(100, score);
}

/**
 * 更新总体状态评估
 * @param {Array} weightRecords 体重记录
 * @param {Array} dietRecords 饮食记录
 * @param {Array} exerciseRecords 运动记录
 * @param {Array} vaccineRecords 疫苗记录
 * @param {Array} dewormingRecords 驱虫记录
 * @param {Array} examinationRecords 体检记录
 * @returns {string} 状态评估
 */
function calculateOverallStatus(weightRecords, dietRecords, exerciseRecords, vaccineRecords, dewormingRecords, examinationRecords) {
  const score = calculateHealthScore(weightRecords, dietRecords, exerciseRecords, vaccineRecords, dewormingRecords, examinationRecords);
  
  if (score >= 85) {
    return '优秀';
  } else if (score >= 70) {
    return '良好';
  } else if (score >= 60) {
    return '一般';
  } else {
    return '需改善';
  }
}

// 疫苗记录相关控制器方法
exports.getVaccineRecords = async (req, res) => {
  try {
    const { pet_id, PetMeetID, startDate, endDate, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;
    
    // 构建查询条件
    let query = { userId };
    
    // 支持通过pet_id或PetMeetID查询
    if (pet_id) query.pet_id = pet_id;
    if (PetMeetID) query.PetMeetID = PetMeetID;
    
    // 支持日期范围查询
    if (startDate || endDate) {
      if (startDate) query.dueDate = _.gte(new Date(startDate));
      if (endDate) query.dueDate = _.lte(new Date(endDate));
      // 如果同时有开始和结束日期，使用and条件
      if (startDate && endDate) {
        query.dueDate = _.and(_.gte(new Date(startDate)), _.lte(new Date(endDate)));
      }
    }
    
    console.log('[健康控制器] 查询疫苗记录:', JSON.stringify(query));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用CloudBase SDK查询数据
    const { total } = await db.collection('ai_vaccine').where(query).count();
    
    // 获取记录列表
    const { data: records } = await db.collection('ai_vaccine')
      .where(query)
      .orderBy('dueDate', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取疫苗记录失败:', error);
    res.status(500).json({ success: false, message: '获取疫苗记录失败', error: error.message });
  }
};

exports.getVaccineRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 使用CloudBase SDK查询数据
    const { data } = await db.collection('ai_vaccine')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '疫苗记录不存在' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('获取疫苗记录详情失败:', error);
    res.status(500).json({ success: false, message: '获取疫苗记录详情失败', error: error.message });
  }
};

exports.createVaccineRecord = async (req, res) => {
  try {
    const { 
      vaccineName, vaccineType, dueDate, status, location, description, 
      pet_id, PetMeetID 
    } = req.body;
    const userId = req.user._id;
    const userOpenid = req.user.openid || req.user._openid;
    const userPetMeetID = req.user.PetMeetID || PetMeetID || '';
    
    if (!vaccineName || !vaccineType || !pet_id) {
      return res.status(400).json({ success: false, message: '疫苗名称、类型和宠物ID为必填项' });
    }
    
    const targetDate = dueDate ? new Date(dueDate) : new Date();
    
    // 构建记录数据
    const newRecord = {
      vaccineName,
      vaccineType,
      dueDate: targetDate,
      status: status || '计划中',
      location: location || '',
      description: description || '',
      pet_id,
      PetMeetID: userPetMeetID,
      _openid: userOpenid,
      userId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      // 添加兼容字段
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    };
    
    console.log('[健康控制器] 创建疫苗记录:', JSON.stringify(newRecord));
    
    // 使用CloudBase SDK添加数据
    const { id } = await db.collection('ai_vaccine').add(newRecord);
    
    // 添加ID到返回数据中
    newRecord._id = id;
    
    res.status(201).json({ success: true, data: newRecord, message: '疫苗记录创建成功' });
  } catch (error) {
    console.error('创建疫苗记录失败:', error);
    res.status(500).json({ success: false, message: '创建疫苗记录失败', error: error.message });
  }
};

exports.updateVaccineRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    const { 
      vaccineName, vaccineType, dueDate, status, location, description 
    } = req.body;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection('ai_vaccine')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '疫苗记录不存在或无权限修改' });
    }
    
    // 构建更新数据
    const updateData = {
      vaccineName, 
      vaccineType, 
      dueDate: dueDate ? new Date(dueDate) : data[0].dueDate,
      status, 
      location: location || data[0].location,
      description,
      updatedAt: db.serverDate()
    };
    
    // 执行更新操作
    await db.collection('ai_vaccine').doc(recordId).update(updateData);
    
    // 返回更新后的完整记录
    const { data: updatedRecord } = await db.collection('ai_vaccine').doc(recordId).get();
    
    res.json({ success: true, data: updatedRecord, message: '疫苗记录更新成功' });
  } catch (error) {
    console.error('更新疫苗记录失败:', error);
    res.status(500).json({ success: false, message: '更新疫苗记录失败', error: error.message });
  }
};

exports.deleteVaccineRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection('ai_vaccine')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '疫苗记录不存在或无权限删除' });
    }
    
    // 执行删除操作
    await db.collection('ai_vaccine').doc(recordId).remove();
    
    res.json({ success: true, message: '疫苗记录删除成功' });
  } catch (error) {
    console.error('删除疫苗记录失败:', error);
    res.status(500).json({ success: false, message: '删除疫苗记录失败', error: error.message });
  }
};

// 驱虫记录相关控制器方法
exports.getDewormingRecords = async (req, res) => {
  try {
    const { pet_id, PetMeetID, startDate, endDate, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;
    
    // 构建查询条件
    let query = { userId };
    
    // 支持通过pet_id或PetMeetID查询
    if (pet_id) query.pet_id = pet_id;
    if (PetMeetID) query.PetMeetID = PetMeetID;
    
    // 支持日期范围查询
    if (startDate || endDate) {
      if (startDate) query.dueDate = _.gte(new Date(startDate));
      if (endDate) query.dueDate = _.lte(new Date(endDate));
      // 如果同时有开始和结束日期，使用and条件
      if (startDate && endDate) {
        query.dueDate = _.and(_.gte(new Date(startDate)), _.lte(new Date(endDate)));
      }
    }
    
    console.log('[健康控制器] 查询驱虫记录:', JSON.stringify(query));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用CloudBase SDK查询数据
    const { total } = await db.collection('ai_deworming').where(query).count();
    
    // 获取记录列表
    const { data: records } = await db.collection('ai_deworming')
      .where(query)
      .orderBy('dueDate', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取驱虫记录失败:', error);
    res.status(500).json({ success: false, message: '获取驱虫记录失败', error: error.message });
  }
};

exports.getDewormingRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 使用CloudBase SDK查询数据
    const { data } = await db.collection('ai_deworming')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '驱虫记录不存在' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('获取驱虫记录详情失败:', error);
    res.status(500).json({ success: false, message: '获取驱虫记录详情失败', error: error.message });
  }
};

exports.createDewormingRecord = async (req, res) => {
  try {
    const { 
      dewormingType, drugName, dueDate, status, location, description, 
      pet_id, PetMeetID 
    } = req.body;
    const userId = req.user._id;
    const userOpenid = req.user.openid || req.user._openid;
    const userPetMeetID = req.user.PetMeetID || PetMeetID || '';
    
    if (!dewormingType || !drugName || !pet_id) {
      return res.status(400).json({ success: false, message: '驱虫类型、药物名称和宠物ID为必填项' });
    }
    
    const targetDate = dueDate ? new Date(dueDate) : new Date();
    
    // 构建记录数据
    const newRecord = {
      dewormingType,
      drugName,
      dueDate: targetDate,
      status: status || '计划中',
      location: location || '',
      description: description || '',
      pet_id,
      PetMeetID: userPetMeetID,
      _openid: userOpenid,
      userId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      // 添加兼容字段
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    };
    
    console.log('[健康控制器] 创建驱虫记录:', JSON.stringify(newRecord));
    
    // 使用CloudBase SDK添加数据
    const { id } = await db.collection('ai_deworming').add(newRecord);
    
    // 添加ID到返回数据中
    newRecord._id = id;
    
    res.status(201).json({ success: true, data: newRecord, message: '驱虫记录创建成功' });
  } catch (error) {
    console.error('创建驱虫记录失败:', error);
    res.status(500).json({ success: false, message: '创建驱虫记录失败', error: error.message });
  }
};

exports.updateDewormingRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    const { 
      dewormingType, drugName, dueDate, status, location, description 
    } = req.body;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection('ai_deworming')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '驱虫记录不存在或无权限修改' });
    }
    
    // 构建更新数据
    const updateData = {
      dewormingType, 
      drugName, 
      dueDate: dueDate ? new Date(dueDate) : data[0].dueDate,
      status, 
      location: location || data[0].location,
      description,
      updatedAt: db.serverDate()
    };
    
    // 执行更新操作
    await db.collection('ai_deworming').doc(recordId).update(updateData);
    
    // 返回更新后的完整记录
    const { data: updatedRecord } = await db.collection('ai_deworming').doc(recordId).get();
    
    res.json({ success: true, data: updatedRecord, message: '驱虫记录更新成功' });
  } catch (error) {
    console.error('更新驱虫记录失败:', error);
    res.status(500).json({ success: false, message: '更新驱虫记录失败', error: error.message });
  }
};

exports.deleteDewormingRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection('ai_deworming')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '驱虫记录不存在或无权限删除' });
    }
    
    // 执行删除操作
    await db.collection('ai_deworming').doc(recordId).remove();
    
    res.json({ success: true, message: '驱虫记录删除成功' });
  } catch (error) {
    console.error('删除驱虫记录失败:', error);
    res.status(500).json({ success: false, message: '删除驱虫记录失败', error: error.message });
  }
};

// 体检记录相关控制器方法
exports.getExaminationRecords = async (req, res) => {
  try {
    const { pet_id, PetMeetID, startDate, endDate, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;
    
    // 构建查询条件
    let query = { userId };
    
    // 支持通过pet_id或PetMeetID查询
    if (pet_id) query.pet_id = pet_id;
    if (PetMeetID) query.PetMeetID = PetMeetID;
    
    // 支持日期范围查询
    if (startDate || endDate) {
      if (startDate) query.dueDate = _.gte(new Date(startDate));
      if (endDate) query.dueDate = _.lte(new Date(endDate));
      // 如果同时有开始和结束日期，使用and条件
      if (startDate && endDate) {
        query.dueDate = _.and(_.gte(new Date(startDate)), _.lte(new Date(endDate)));
      }
    }
    
    console.log('[健康控制器] 查询体检记录:', JSON.stringify(query));
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用CloudBase SDK查询数据
    const { total } = await db.collection('ai_examination').where(query).count();
    
    // 获取记录列表
    const { data: records } = await db.collection('ai_examination')
      .where(query)
      .orderBy('dueDate', 'desc')
      .skip(skip)
      .limit(parseInt(limit))
      .get();
    
    res.json({
      success: true,
      data: records,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取体检记录失败:', error);
    res.status(500).json({ success: false, message: '获取体检记录失败', error: error.message });
  }
};

exports.getExaminationRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 使用CloudBase SDK查询数据
    const { data } = await db.collection('ai_examination')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '体检记录不存在' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('获取体检记录详情失败:', error);
    res.status(500).json({ success: false, message: '获取体检记录详情失败', error: error.message });
  }
};

exports.createExaminationRecord = async (req, res) => {
  try {
    const { 
      examinationType, hospital, doctor, dueDate, status, 
      results, description, pet_id, PetMeetID,
      // 支持旧格式字段名
      name, result, remark, examination_date
    } = req.body;
    const userId = req.user._id;
    const userOpenid = req.user.openid || req.user._openid;
    const userPetMeetID = req.user.PetMeetID || PetMeetID || '';
    
    // 兼容新旧字段名
    const examinationName = name || examinationType;
    const examinationResult = result || results || '';
    const examinationRemark = remark || description || '';
    const examinationDate = examination_date || dueDate;
    
    if (!examinationName || !hospital || !pet_id) {
      return res.status(400).json({ success: false, message: '体检类型、医院和宠物ID为必填项' });
    }
    
    const currentDate = new Date();
    const targetDate = examinationDate ? new Date(examinationDate) : currentDate;
    
    // 构建兼容旧格式的记录数据
    const newRecord = {
      // 新格式字段
      examinationType: examinationName,
      hospital,
      doctor: doctor || '',
      dueDate: targetDate,
      status: status || '计划中',
      results: examinationResult,
      description: examinationRemark,
      pet_id,
      PetMeetID: userPetMeetID,
      userId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      
      // 旧格式兼容字段
      name: examinationName,
      result: examinationResult,
      remark: examinationRemark,
      examination_date: targetDate,
      lastDate: targetDate,
      importance: 'normal', // 默认重要程度
      advanceNotice: 7, // 默认提前7天提醒
      _openid: userOpenid,
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    };
    
    console.log('[健康控制器] 创建体检记录:', JSON.stringify(newRecord));
    
    // 使用CloudBase SDK添加数据
    const { id } = await db.collection('ai_examination').add(newRecord);
    
    // 添加ID到返回数据中
    newRecord._id = id;
    
    res.status(201).json({ success: true, data: newRecord, message: '体检记录创建成功' });
  } catch (error) {
    console.error('创建体检记录失败:', error);
    res.status(500).json({ success: false, message: '创建体检记录失败', error: error.message });
  }
};

exports.updateExaminationRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    const { 
      examinationType, hospital, doctor, dueDate, status, 
      results, description 
    } = req.body;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection('ai_examination')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '体检记录不存在或无权限修改' });
    }
    
    // 构建更新数据
    const updateData = {
      examinationType, 
      hospital, 
      doctor: doctor || data[0].doctor,
      dueDate: dueDate ? new Date(dueDate) : data[0].dueDate,
      status, 
      results: results || data[0].results,
      description,
      updatedAt: db.serverDate()
    };
    
    // 执行更新操作
    await db.collection('ai_examination').doc(recordId).update(updateData);
    
    // 返回更新后的完整记录
    const { data: updatedRecord } = await db.collection('ai_examination').doc(recordId).get();
    
    res.json({ success: true, data: updatedRecord, message: '体检记录更新成功' });
  } catch (error) {
    console.error('更新体检记录失败:', error);
    res.status(500).json({ success: false, message: '更新体检记录失败', error: error.message });
  }
};

exports.deleteExaminationRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = req.user._id;
    
    // 先检查记录是否存在且属于当前用户
    const { data } = await db.collection('ai_examination')
      .where({
        _id: recordId,
        userId: userId
      })
      .get();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: '体检记录不存在或无权限删除' });
    }
    
    // 执行删除操作
    await db.collection('ai_examination').doc(recordId).remove();
    
    res.json({ success: true, message: '体检记录删除成功' });
  } catch (error) {
    console.error('删除体检记录失败:', error);
    res.status(500).json({ success: false, message: '删除体检记录失败', error: error.message });
  }
};
