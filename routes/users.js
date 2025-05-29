const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/cloudbaseConfig');

// 获取数据库实例
const db = getDatabase();

// 添加用户
router.post('/add', async (req, res) => {
    try {
        console.log('👤 [用户添加] 开始添加用户:', req.body);
        
        const {
            nickName,
            avatarUrl,
            gender,
            city,
            province,
            birthday,
            bio,
            petInfo
        } = req.body;

        // 验证必需字段
        if (!nickName) {
            return res.status(400).json({
                success: false,
                message: '昵称是必需的'
            });
        }

        // 生成用户数据
        const userData = {
            nickName,
            avatarUrl: avatarUrl || 'https://via.placeholder.com/150',
            gender: gender || 'unknown',
            city: city || '',
            province: province || '',
            birthday: birthday || '',
            bio: bio || '',
            petInfo: petInfo || [],
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            status: 'active',
            // 生成PetMeet ID
            PetMeetID: `PM${Date.now().toString().slice(-6)}`
        };

        // 添加到数据库
        const result = await db.collection('user_profile').add(userData);
        
        console.log('✅ [用户添加] 用户添加成功:', result.id);
        
        res.json({
            success: true,
            message: '用户添加成功',
            data: {
                _id: result.id,
                ...userData
            }
        });
        
    } catch (error) {
        console.error('❌ [用户添加] 失败:', error);
        res.status(500).json({
            success: false,
            message: '添加用户失败',
            error: error.message
        });
    }
});

// 获取所有用户
router.get('/', async (req, res) => {
    try {
        console.log('📋 [用户列表] 获取用户列表');
        
        const { data: users } = await db.collection('user_profile').get();
        
        console.log(`📊 [用户列表] 获取到 ${users.length} 个用户`);
        
        res.json({
            success: true,
            data: users,
            total: users.length
        });
        
    } catch (error) {
        console.error('❌ [用户列表] 获取失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error.message
        });
    }
});

// 获取单个用户
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📋 [用户详情] 获取用户: ${id}`);
        
        const { data: users } = await db.collection('user_profile').get();
        const user = users.find(u => u._id === id || u._openid === id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        console.error('❌ [用户详情] 获取失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户详情失败',
            error: error.message
        });
    }
});

// 更新用户
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
            updateTime: new Date().toISOString()
        };
        
        console.log(`📝 [用户更新] 更新用户: ${id}`, updateData);
        
        const result = await db.collection('user_profile').doc(id).update(updateData);
        
        console.log('✅ [用户更新] 更新成功');
        
        res.json({
            success: true,
            message: '用户更新成功',
            data: result
        });
        
    } catch (error) {
        console.error('❌ [用户更新] 失败:', error);
        res.status(500).json({
            success: false,
            message: '更新用户失败',
            error: error.message
        });
    }
});

// 删除用户
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ [用户删除] 删除用户: ${id}`);
        
        const result = await db.collection('user_profile').doc(id).remove();
        
        console.log('✅ [用户删除] 删除成功');
        
        res.json({
            success: true,
            message: '用户删除成功',
            data: result
        });
        
    } catch (error) {
        console.error('❌ [用户删除] 失败:', error);
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error.message
        });
    }
});

module.exports = router; 