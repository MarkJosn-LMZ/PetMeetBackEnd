const { getDatabase } = require('../config/cloudbaseConfig');

// 获取数据库和集合引用
const db = getDatabase();
const todoCollection = db.collection('todos');

/**
 * 获取所有Todo
 */
const getAllTodos = async (req, res) => {
  try {
    // 获取当前用户ID和PetMeetID
    const userId = req.user?.userId;
    const PetMeetID = req.user?.PetMeetID;
    
    // 如果有PetMeetID，优先使用PetMeetID查询
    let query = {};
    
    if (PetMeetID) {
      query = { PetMeetID: PetMeetID };
    } else if (userId) {
      query = { userId: userId };
    }
    
    const { data } = await todoCollection
      .where(query)
      .orderBy('createTime', 'desc')
      .get();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('获取Todo列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Todo列表失败',
      error: error.message
    });
  }
};

/**
 * 根据ID获取Todo
 */
const getTodoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data } = await todoCollection.doc(id).get();
    
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Todo不存在'
      });
    }
    
    res.json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    console.error('获取Todo详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Todo详情失败',
      error: error.message
    });
  }
};

/**
 * 创建新Todo
 */
const createTodo = async (req, res) => {
  try {
    const { title, content, status = 'pending' } = req.body;
    const userId = req.user?.userId;
    const PetMeetID = req.user?.PetMeetID;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Todo标题不能为空'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未登录或登录已过期'
      });
    }
    
    // 创建新的Todo
    const todo = {
      title,
      content: content || '',
      status,
      userId: userId,
      PetMeetID: PetMeetID, // 添加PetMeetID
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };
    
    const result = await todoCollection.add(todo);
    
    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        ...todo
      }
    });
  } catch (error) {
    console.error('创建Todo失败:', error);
    res.status(500).json({
      success: false,
      message: '创建Todo失败',
      error: error.message
    });
  }
};

/**
 * 更新Todo
 */
const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, status } = req.body;
    
    const updateData = {};
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) updateData.status = status;
    
    updateData.updateTime = new Date();
    
    // 检查是否存在
    const { data } = await todoCollection.doc(id).get();
    
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Todo不存在'
      });
    }
    
    await todoCollection.doc(id).update(updateData);
    
    res.json({
      success: true,
      message: 'Todo更新成功'
    });
  } catch (error) {
    console.error('更新Todo失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Todo失败',
      error: error.message
    });
  }
};

/**
 * 删除Todo
 */
const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否存在
    const { data } = await todoCollection.doc(id).get();
    
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Todo不存在'
      });
    }
    
    await todoCollection.doc(id).remove();
    
    res.json({
      success: true,
      message: 'Todo删除成功'
    });
  } catch (error) {
    console.error('删除Todo失败:', error);
    res.status(500).json({
      success: false,
      message: '删除Todo失败',
      error: error.message
    });
  }
};

module.exports = {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo
};
