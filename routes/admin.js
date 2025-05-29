const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/cloudbaseConfig');
const jwt = require('jsonwebtoken'); // 添加JWT支持

// 获取数据库实例
const db = getDatabase();

// JWT认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: '访问令牌未提供'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('JWT验证失败:', err.message);
            return res.status(403).json({
                success: false,
                message: '访问令牌无效'
            });
        }
        
        req.user = user;
        next();
    });
};

// 生成JWT token的路由
router.post('/auth/login', async (req, res) => {
    try {
        const { openid, nickName } = req.body;
        
        if (!openid) {
            return res.status(400).json({
                success: false,
                message: 'OpenID是必需的'
            });
        }

        // 验证用户是否存在
        const { data: users } = await db.collection('user_profile').get();
        const user = users.find(u => u._openid === openid);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 生成JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                openid: user._openid,
                nickName: user.nickName || nickName || '管理员',
                role: 'admin',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时过期
            },
            process.env.JWT_SECRET
        );

        console.log('✅ 生成JWT token成功:', user.nickName || '管理员');
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user._id,
                openid: user._openid,
                nickName: user.nickName,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误',
            error: error.message
        });
    }
});

// 验证JWT token的路由
router.get('/auth/validate', authenticateToken, async (req, res) => {
    try {
        // 如果通过了authenticateToken中间件，说明token有效
        const user = req.user;
        
        console.log('✅ Token验证成功:', user);
        
        res.json({
            success: true,
            message: 'Token有效',
            user: {
                id: user.userId,
                openid: user.openid,
                nickName: user.nickName,
                role: user.role || 'admin'
            }
        });
    } catch (error) {
        console.error('Token验证失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误',
            error: error.message
        });
    }
});

// 获取所有用户 - 添加认证保护
router.get('/users', authenticateToken, async (req, res) => {
    try {
        console.log('📋 管理员获取真实用户列表');
        
        // 从CloudBase数据库获取用户信息
        const { data: users } = await db.collection('user_profile').get();
        
        // 处理用户数据，添加必要的字段
        const processedUsers = users.map(user => ({
            _id: user._id,
            _openid: user._openid,
            PetMeetID: user.PetMeetID || `PM${user._id?.slice(-6)}`,
            nickName: user.nickName || '未设置昵称',
            avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
            createdAt: user.createdAt || user._createTime,
            updatedAt: user.updatedAt || user._updateTime,
            status: user.status || 'active',
            // 添加其他用户信息
            gender: user.gender,
            city: user.city,
            province: user.province,
            country: user.country,
            petInfo: user.petInfo || [],
            // 添加AI生成标识字段
            isAIGenerated: user.isAIGenerated || false,
            virtualSource: user.virtualSource || null
        }));
        
        // 统计真实用户和虚拟用户 - 修复逻辑
        // 真实用户：原始数据中没有isAIGenerated字段的用户
        const realUsers = processedUsers.filter(user => {
            // 从原始数据检查，而不是处理后的数据
            const originalUser = users.find(u => u._id === user._id);
            return !originalUser || !originalUser.hasOwnProperty('isAIGenerated');
        });
        const virtualUsers = processedUsers.filter(user => {
            // 从原始数据检查
            const originalUser = users.find(u => u._id === user._id);
            return originalUser && originalUser.hasOwnProperty('isAIGenerated');
        });
        
        console.log(`📊 获取到 ${processedUsers.length} 个用户 (真实用户: ${realUsers.length}, 虚拟用户: ${virtualUsers.length})`);
        
        res.json({
            success: true,
            data: processedUsers,
            total: processedUsers.length,
            message: `获取用户列表成功，共 ${processedUsers.length} 个用户 (真实: ${realUsers.length}, 虚拟: ${virtualUsers.length})`
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error.message
        });
    }
});

// 创建用户 - 添加认证保护
router.post('/users', authenticateToken, async (req, res) => {
    try {
        const { 
            nickName, 
            avatarUrl, 
            status, 
            PetMeetID, 
            gender, 
            city,
            province,
            country,
            language,
            birthday,
            bio, 
            level, 
            experience,
            petInfo,
            isAIGenerated,
            aiModel,
            _openid
        } = req.body;
        
        if (!nickName) {
            return res.status(400).json({
                success: false,
                message: '用户昵称是必需的'
            });
        }

        console.log('🆕 创建新用户:', nickName, { city, province, country, isAIGenerated });

        // 生成唯一的openid（如果没有提供）
        const openid = _openid || `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 生成PetMeetID（如果没有提供）
        let generatedPetMeetID = PetMeetID;
        if (!generatedPetMeetID) {
            try {
                const { generateCompactPetMeetID } = require('../utils/idMapping');
                generatedPetMeetID = await generateCompactPetMeetID(openid);
            } catch (error) {
                console.warn('生成PetMeetID失败，使用备用方案:', error.message);
                generatedPetMeetID = `PM${Date.now().toString().slice(-6)}`;
            }
        }
        
        // 创建新用户数据
        const newUser = {
            _openid: openid,
            PetMeetID: generatedPetMeetID,
            nickName: nickName,
            avatarUrl: avatarUrl || 'https://via.placeholder.com/100x100?text=' + encodeURIComponent(nickName.charAt(0)),
            status: status || 'active',
            gender: gender || '',
            city: city || '',
            province: province || '',
            country: country || '中国',
            language: language || 'zh_CN',
            birthday: birthday || '',
            bio: bio || '',
            level: level || 1,
            experience: experience || 0,
            petInfo: petInfo || [],
            isAIGenerated: isAIGenerated || false,
            aiModel: aiModel || '',
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 保存到数据库
        const result = await db.collection('user_profile').add(newUser);
        
        // 返回创建的用户数据
        const createdUser = {
            _id: result.id,
            ...newUser
        };

        console.log('✅ 用户创建成功:', createdUser._id, createdUser.nickName);
        
        res.json({
            success: true,
            data: createdUser,
            message: '用户创建成功'
        });
    } catch (error) {
        console.error('创建用户失败:', error);
        res.status(500).json({
            success: false,
            message: '创建用户失败',
            error: error.message
        });
    }
});

// 获取单个用户详情 - 添加认证保护
router.get('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📋 管理员获取用户详情: ${id}`);
        
        // 暂时使用从所有用户中查找的方式
        const { data: allUsers } = await db.collection('user_profile').get();
        console.log(`🔍 数据库中共有 ${allUsers.length} 个用户`);
        
        const user = allUsers.find(u => u._id === id || u._openid === id);
        
        if (!user) {
            console.log(`❌ 用户不存在: ${id}`);
            console.log(`🔍 可用的用户ID:`, allUsers.map(u => u._id).slice(0, 3));
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        console.log(`🔍 找到的用户原始数据:`, JSON.stringify(user, null, 2));

        // 实时计算用户的帖文数量
        let actualPostCount = 0;
        try {
            // 同时使用用户的 _openid 和 _id 查询帖文，确保完整性
            const { data: userPosts } = await db.collection('ai_post').where({
                $or: [
                    { _openid: user._openid },
                    { authorId: user._id },
                    { authorId: user._openid }
                ]
            }).get();
            
            // 过滤掉已删除的帖文
            const activePosts = userPosts.filter(post => 
                post.status !== 'deleted' && 
                post.status !== 'removed'
            );
            
            actualPostCount = activePosts.length;
            console.log(`📊 用户 ${user.nickName || user._openid} 实际帖文数量: ${actualPostCount} (总计 ${userPosts.length}，有效 ${activePosts.length})`);
        } catch (postError) {
            console.warn('⚠️ 计算帖文数量失败，使用默认值 0:', postError.message);
            actualPostCount = 0;
        }

        // 处理用户数据
        const processedUser = {
            _id: user._id,
            _openid: user._openid,
            PetMeetID: user.PetMeetID || `PM${(user._id || '').slice(-6)}`,
            nickName: user.nickName || '未设置昵称',
            avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
            createdAt: user.createdAt || user._createTime,
            updatedAt: user.updatedAt || user._updateTime,
            status: user.status || 'active',
            gender: user.gender || null,
            city: user.city || null,
            province: user.province || null,
            country: user.country || null,
            petInfo: user.petInfo || [],
            bio: user.bio || null,
            birthday: user.birthday || null,
            stats: user.stats || {},
            postCount: actualPostCount // 使用实时计算的帖文数量
        };

        console.log(`📋 处理后的用户数据:`, JSON.stringify(processedUser, null, 2));
        console.log(`📋 获取用户详情成功: ${processedUser.nickName}`);
        
        res.json({
            success: true,
            data: processedUser,
            message: '获取用户详情成功'
        });
    } catch (error) {
        console.error('获取用户详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户详情失败',
            error: error.message
        });
    }
});

// 更新用户信息 - 添加认证保护
router.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        console.log(`📝 管理员更新用户: ${id}`, updates);
        
        // 添加更新时间
        const updateData = {
            ...updates,
            updateTime: new Date().toISOString(),
            updatedAt: new Date()
        };
        
        // 更新数据库中的用户信息
        await db.collection('user_profile').doc(id).update(updateData);
        
        // 获取更新后的用户信息
        const { data: updatedUser } = await db.collection('user_profile').doc(id).get();
        
        console.log(`📝 用户更新成功: ${updatedUser.nickName || id}`);
        
        res.json({
            success: true,
            data: updatedUser,
            message: '更新用户信息成功'
        });
    } catch (error) {
        console.error('更新用户失败:', error);
        res.status(500).json({
            success: false,
            message: '更新用户失败',
            error: error.message
        });
    }
});

// 删除用户 - 添加认证保护
router.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🗑️ 管理员删除用户: ${id}`);
        
        // 获取用户信息（删除前）
        const { data: userToDeleteArray } = await db.collection('user_profile').doc(id).get();
        
        // CloudBase的doc().get()返回的data可能是数组格式，需要正确解析
        let userToDelete = null;
        if (Array.isArray(userToDeleteArray) && userToDeleteArray.length > 0) {
            userToDelete = userToDeleteArray[0];
        } else if (userToDeleteArray && !Array.isArray(userToDeleteArray)) {
            userToDelete = userToDeleteArray;
        }
        
        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        console.log(`🗑️ 准备删除用户: ${userToDelete.nickName || id}`);
        
        // 真正删除用户（硬删除）
        const deleteResult = await db.collection('user_profile').doc(id).remove();
        
        console.log(`🗑️ 用户删除成功: ${userToDelete.nickName || id}`, deleteResult);
        
        res.json({
            success: true,
            data: userToDelete,
            message: '用户删除成功'
        });
    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error.message
        });
    }
});

// 获取用户帖文 - 添加认证保护
router.get('/users/:id/posts', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📰 管理员获取用户帖文: ${id}`);
        
        // 获取用户信息（需要先查找完整的用户信息）
        const { data: allUsers } = await db.collection('user_profile').get();
        const user = allUsers.find(u => u._id === id || u._openid === id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 使用与用户详情API相同的查询逻辑获取用户帖文
        const { data: posts } = await db.collection('ai_post').where({
            $or: [
                { _openid: user._openid },
                { authorId: user._id },
                { authorId: user._openid }
            ]
        }).orderBy('createdAt', 'desc').get(); // 修改：统一使用createdAt排序

        // 过滤掉已删除的帖文
        const activePosts = posts.filter(post => 
            post.status !== 'deleted' && 
            post.status !== 'removed'
        );

        console.log(`📰 获取到用户 ${user.nickName || id} 的 ${activePosts.length} 篇有效帖文 (总计 ${posts.length} 篇)`);
        
        res.json({
            success: true,
            data: activePosts,
            total: activePosts.length,
            message: `获取用户帖文成功，共 ${activePosts.length} 篇帖文`
        });
    } catch (error) {
        console.error('获取用户帖文失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户帖文失败',
            error: error.message
        });
    }
});

// 获取系统统计信息
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 管理员获取系统统计');
        
        // 获取用户统计
        const { data: allUsers } = await db.collection('user_profile').get();
        const activeUsers = allUsers.filter(u => u.status !== 'deleted' && u.status !== 'inactive');
        const inactiveUsers = allUsers.filter(u => u.status === 'inactive');
        
        // 获取帖文统计（安全处理）
        let totalPosts = 0;
        let todayPosts = 0;
        try {
            const { data: allPosts } = await db.collection('ai_post').get();
            totalPosts = allPosts.length;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            todayPosts = allPosts.filter(p => {
                const createTime = new Date(p.createTime || p._createTime);
                return createTime >= today;
            }).length;
            console.log(`📰 帖文统计: 总计 ${totalPosts} 篇，今日 ${todayPosts} 篇`);
        } catch (e) {
            console.log('ai_post集合不存在，跳过帖文统计');
        }
        
        // 获取评论统计（安全处理）
        let totalComments = 0;
        let todayComments = 0;
        try {
            const { data: allComments } = await db.collection('comments').get();
            totalComments = allComments.length;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            todayComments = allComments.filter(c => {
                const createTime = new Date(c.createTime || c._createTime);
                return createTime >= today;
            }).length;
            console.log(`💬 评论统计: 总计 ${totalComments} 条，今日 ${todayComments} 条`);
        } catch (e) {
            console.log('comments集合不存在，跳过评论统计');
        }

        const stats = {
            totalUsers: allUsers.length,
            activeUsers: activeUsers.length,
            inactiveUsers: inactiveUsers.length,
            totalPosts: totalPosts,
            todayPosts: todayPosts,
            totalComments: totalComments,
            todayComments: todayComments
        };

        console.log('📊 系统统计信息:', stats);
        
        res.json({
            success: true,
            data: stats,
            message: '获取系统统计成功'
        });
    } catch (error) {
        console.error('获取系统统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统统计失败',
            error: error.message
        });
    }
});

// AI配置管理 - 获取所有可用的AI模型
router.get('/ai/config', async (req, res) => {
    try {
        console.log('🤖 获取AI配置 (无认证)');
        
        // 从数据库获取所有AI模型
        let aiModels = [];
        try {
            const { data } = await db.collection('AI_Model').get();
            aiModels = data;
        } catch (error) {
            if (error.code === 'DATABASE_COLLECTION_NOT_EXIST') {
                console.log('📁 AI_Model集合不存在，返回空模型列表');
                aiModels = [];
            } else {
                throw error;
            }
        }
        
        // 按类型分组
        const textModels = aiModels.filter(model => model.type === 'text' && model.isActive);
        const imageModels = aiModels.filter(model => model.type === 'image' && model.isActive);
        
        // 获取当前系统配置
        let systemConfig;
        try {
            console.log('🔍 尝试获取aiConfig集合中的system文档');
            const configResult = await db.collection('aiConfig').doc('system').get();
            console.log('📋 配置查询结果:', { 
                hasData: !!configResult.data, 
                dataType: Array.isArray(configResult.data) ? 'array' : typeof configResult.data,
                dataLength: Array.isArray(configResult.data) ? configResult.data.length : 'N/A'
            });
            
            // CloudBase的doc().get()返回的data可能是数组格式，需要正确解析
            if (Array.isArray(configResult.data) && configResult.data.length > 0) {
                systemConfig = configResult.data[0];
                console.log('📋 使用数组中的第一个配置:', { selectedTextModel: systemConfig.selectedTextModel });
            } else if (configResult.data && !Array.isArray(configResult.data)) {
                systemConfig = configResult.data;
                console.log('📋 使用对象配置:', { selectedTextModel: systemConfig.selectedTextModel });
            } else {
                throw new Error('配置数据为空');
            }
        } catch (e) {
            // 如果没有配置或集合不存在，使用默认值
            console.log('📁 aiConfig集合不存在或配置不存在，使用默认配置, 错误:', e.message);
            systemConfig = {
                selectedTextModel: null,
                selectedImageModel: null,
                moderationEnabled: true,
                autoReply: false
            };
        }
        
        console.log(`📋 获取到 ${textModels.length} 个文本模型，${imageModels.length} 个图像模型`);
        
        const config = {
            availableModels: {
                text: textModels.map(model => ({
                    id: model._id,
                    name: model.name,
                    provider: model.provider,
                    model: model.model,
                    description: model.description,
                    config: model.config,
                    isActive: model.isActive
                })),
                image: imageModels.map(model => ({
                    id: model._id,
                    name: model.name,
                    provider: model.provider,
                    model: model.model,
                    description: model.description,
                    config: model.config,
                    isActive: model.isActive
                }))
            },
            currentConfig: {
                selectedTextModel: systemConfig.selectedTextModel,
                selectedImageModel: systemConfig.selectedImageModel,
                moderationEnabled: systemConfig.moderationEnabled || true,
                autoReply: systemConfig.autoReply || false,
                lastUpdated: systemConfig.lastUpdated
            }
        };
        
        res.json({
            success: true,
            data: config,
            message: '获取AI配置成功'
        });
    } catch (error) {
        console.error('获取AI配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取AI配置失败',
            error: error.message
        });
    }
});

// 更新AI配置 - 选择使用的模型
router.put('/ai/config', async (req, res) => {
    try {
        const { 
            selectedTextModel, 
            selectedImageModel, 
            moderationEnabled, 
            autoReply,
            textModelParams,
            imageModelParams
        } = req.body;
        
        console.log('🤖 管理员更新AI配置:', { 
            selectedTextModel, 
            selectedImageModel, 
            moderationEnabled, 
            autoReply,
            textModelParams,
            imageModelParams
        });
        
        // 验证选择的模型是否存在
        if (selectedTextModel) {
            try {
                const textModelResult = await db.collection('AI_Model').doc(selectedTextModel).get();
                console.log('🔍 文本模型查询结果:', { 
                    hasData: !!textModelResult.data, 
                    dataType: Array.isArray(textModelResult.data) ? 'array' : typeof textModelResult.data,
                    dataLength: Array.isArray(textModelResult.data) ? textModelResult.data.length : 'N/A'
                });
                
                // CloudBase的doc().get()返回的data可能是数组格式，需要正确解析
                let textModel = null;
                if (Array.isArray(textModelResult.data) && textModelResult.data.length > 0) {
                    textModel = textModelResult.data[0];
                } else if (textModelResult.data && !Array.isArray(textModelResult.data)) {
                    textModel = textModelResult.data;
                }
                
                console.log('📋 解析后的文本模型:', { 
                    exists: !!textModel, 
                    name: textModel?.name, 
                    type: textModel?.type,
                    isActive: textModel?.isActive 
                });
                
                if (!textModel || textModel.type !== 'text' || !textModel.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: '选择的文本模型无效或已禁用'
                    });
                }
            } catch (error) {
                console.warn('⚠️ 验证文本模型时出错:', error.message);
                return res.status(400).json({
                    success: false,
                    message: '验证文本模型失败: ' + error.message
                });
            }
        }
        
        if (selectedImageModel) {
            try {
                const imageModelResult = await db.collection('AI_Model').doc(selectedImageModel).get();
                console.log('🔍 图像模型查询结果:', { 
                    hasData: !!imageModelResult.data, 
                    dataType: Array.isArray(imageModelResult.data) ? 'array' : typeof imageModelResult.data
                });
                
                // CloudBase的doc().get()返回的data可能是数组格式，需要正确解析
                let imageModel = null;
                if (Array.isArray(imageModelResult.data) && imageModelResult.data.length > 0) {
                    imageModel = imageModelResult.data[0];
                } else if (imageModelResult.data && !Array.isArray(imageModelResult.data)) {
                    imageModel = imageModelResult.data;
                }
                
                console.log('📋 解析后的图像模型:', { 
                    exists: !!imageModel, 
                    name: imageModel?.name, 
                    type: imageModel?.type,
                    isActive: imageModel?.isActive 
                });
                
                if (!imageModel || imageModel.type !== 'image' || !imageModel.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: '选择的图像模型无效或已禁用'
                    });
                }
            } catch (error) {
                console.warn('⚠️ 验证图像模型时出错:', error.message);
                return res.status(400).json({
                    success: false,
                    message: '验证图像模型失败: ' + error.message
                });
            }
        }
        
        // 验证文本模型参数
        const validatedTextParams = {
            max_tokens: 2000,
            temperature: 0.7,
            ...(textModelParams || {})
        };
        
        // 验证参数范围
        if (validatedTextParams.max_tokens < 100 || validatedTextParams.max_tokens > 8000) {
            validatedTextParams.max_tokens = Math.max(100, Math.min(8000, validatedTextParams.max_tokens));
        }
        
        if (validatedTextParams.temperature < 0 || validatedTextParams.temperature > 2) {
            validatedTextParams.temperature = Math.max(0, Math.min(2, validatedTextParams.temperature));
        }
        
        // 验证图像模型参数
        const validatedImageParams = {
            n: 1,
            size: '1024x1024',
            ...(imageModelParams || {})
        };
        
        // 验证图像参数
        const validSizes = ['512x512', '1024x1024', '1024x1792', '1792x1024'];
        if (!validSizes.includes(validatedImageParams.size)) {
            validatedImageParams.size = '1024x1024';
        }
        
        if (validatedImageParams.n < 1 || validatedImageParams.n > 4) {
            validatedImageParams.n = Math.max(1, Math.min(4, validatedImageParams.n));
        }
        
        // 保存配置到数据库
        const configData = {
            selectedTextModel,
            selectedImageModel,
            moderationEnabled: moderationEnabled !== undefined ? moderationEnabled : true,
            autoReply: autoReply !== undefined ? autoReply : false,
            textModelParams: validatedTextParams,
            imageModelParams: validatedImageParams,
            lastUpdated: new Date()
        };
        
        try {
            // 尝试保存配置，如果集合不存在则会自动创建
            await db.collection('aiConfig').doc('system').set(configData);
            console.log('✅ AI配置更新成功', configData);
        } catch (dbError) {
            if (dbError.code === 'DATABASE_COLLECTION_NOT_EXIST') {
                console.log('📁 aiConfig集合不存在，创建配置记录...');
                // 集合不存在，尝试添加文档来创建集合
                await db.collection('aiConfig').add({
                    _id: 'system',
                    ...configData
                });
                console.log('✅ 创建aiConfig集合并保存配置成功');
            } else {
                throw dbError;
            }
        }
        
        res.json({
            success: true,
            data: configData,
            message: '更新AI配置成功'
        });
    } catch (error) {
        console.error('更新AI配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新AI配置失败',
            error: error.message
        });
    }
});

// 获取指定AI模型的详细信息
router.get('/ai/models/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🤖 获取AI模型详情: ${id} (无认证)`);
        
        const { data: model } = await db.collection('AI_Model').doc(id).get();
        
        if (!model) {
            return res.status(404).json({
                success: false,
                message: 'AI模型不存在'
            });
        }
        
        res.json({
            success: true,
            data: model,
            message: '获取AI模型详情成功'
        });
    } catch (error) {
        console.error('获取AI模型详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取AI模型详情失败',
            error: error.message
        });
    }
});

// 获取所有AI模型列表（包括未激活的）
router.get('/ai/models', async (req, res) => {
    try {
        console.log('🤖 获取所有AI模型列表 (无认证)');
        
        const { data: aiModels } = await db.collection('AI_Model').get();
        
        // 按类型和提供商分组
        const groupedModels = aiModels.reduce((acc, model) => {
            if (!acc[model.type]) acc[model.type] = {};
            if (!acc[model.type][model.provider]) acc[model.type][model.provider] = [];
            acc[model.type][model.provider].push({
                id: model._id,
                name: model.name,
                model: model.model,
                description: model.description,
                isActive: model.isActive,
                config: model.config,
                createdAt: model.createdAt,
                updatedAt: model.updatedAt
            });
            return acc;
        }, {});
        
        console.log(`📋 获取到 ${aiModels.length} 个AI模型`);
        
        res.json({
            success: true,
            data: {
                models: aiModels,
                grouped: groupedModels,
                total: aiModels.length
            },
            message: `获取AI模型列表成功，共 ${aiModels.length} 个模型`
        });
    } catch (error) {
        console.error('获取AI模型列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取AI模型列表失败',
            error: error.message
        });
    }
});

// 更新AI模型状态
router.put('/ai/models/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        console.log(`🤖 更新AI模型: ${id} (无认证)`, updates);
        
        // 添加更新时间
        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        await db.collection('AI_Model').doc(id).update(updateData);
        
        // 获取更新后的模型信息
        const { data: updatedModel } = await db.collection('AI_Model').doc(id).get();
        
        console.log(`✅ AI模型更新成功: ${updatedModel.name}`);
        
        res.json({
            success: true,
            data: updatedModel,
            message: 'AI模型更新成功'
        });
    } catch (error) {
        console.error('更新AI模型失败:', error);
        res.status(500).json({
            success: false,
            message: '更新AI模型失败',
            error: error.message
        });
    }
});

// 删除AI模型 - 管理面板需要
router.delete('/ai-models/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ 删除AI模型:', id);
        
        // 先获取模型信息用于日志
        const { data } = await db.collection('AI_Model').doc(id).get();
        
        let model = null;
        if (Array.isArray(data) && data.length > 0) {
            model = data[0];
        } else if (data && !Array.isArray(data)) {
            model = data;
        }
        
        if (!model) {
            return res.status(404).json({
                success: false,
                message: 'AI模型不存在'
            });
        }
        
        // 删除模型
        await db.collection('AI_Model').doc(id).remove();
        
        console.log('✅ AI模型删除成功:', model.name);
        
        res.json({
            success: true,
            message: `AI模型删除成功: ${model.name}`
        });
    } catch (error) {
        console.error('删除AI模型失败:', error);
        res.status(500).json({
            success: false,
            message: '删除AI模型失败: ' + error.message
        });
    }
});

// 测试AI模型 - 管理面板需要
router.post('/ai-models/:id/test', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🧪 测试AI模型:', id);
        
        // 获取模型信息
        const { data } = await db.collection('AI_Model').doc(id).get();
        
        let model = null;
        if (Array.isArray(data) && data.length > 0) {
            model = data[0];
        } else if (data && !Array.isArray(data)) {
            model = data;
        }
        
        if (!model) {
            return res.status(404).json({
                success: false,
                message: 'AI模型不存在'
            });
        }
        
        if (!model.isActive) {
            return res.status(400).json({
                success: false,
                message: 'AI模型已禁用'
            });
        }
        
        // 根据模型类型选择测试方法
        let testResult;
        if (model.type === 'image') {
            testResult = await testImageModel(model);
        } else {
            testResult = await testTextModel(model);
        }
        
        // 更新模型的测试状态
        await db.collection('AI_Model').doc(id).update({
            lastTestTime: new Date().toISOString(),
            testStatus: testResult.success ? 'success' : 'failed',
            lastTestError: testResult.success ? null : testResult.error
        });
        
        res.json(testResult);
    } catch (error) {
        console.error('测试AI模型失败:', error);
        res.status(500).json({
            success: false,
            message: '测试AI模型失败: ' + error.message
        });
    }
});

// 测试文本模型
async function testTextModel(model) {
    try {
        const axios = require('axios');
        const testPrompt = '请简短回答：你好';
        
        const headers = {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
        };
        
        const requestData = {
            model: model.model,
            messages: [
                { role: 'user', content: testPrompt }
            ],
            max_tokens: 100,
            temperature: 0.7
        };
        
        console.log(`🧪 测试文本模型: ${model.name}`);
        
        const startTime = Date.now();
        const response = await axios.post(
            `${model.baseURL}/chat/completions`,
            requestData,
            { headers, timeout: 60000 } // 测试增加到60秒
        );
        
        const responseTime = Date.now() - startTime;
        const aiResponse = response.data.choices?.[0]?.message?.content || '无响应';
        
        return {
            success: true,
            message: `文本模型测试成功`,
            data: {
                modelType: 'text',
                response: aiResponse,
                responseTime,
                testPrompt
            }
        };
    } catch (error) {
        return {
            success: false,
            message: `文本模型测试失败: ${error.message}`,
            error: error.message
        };
    }
}

// 测试图像模型
async function testImageModel(model) {
    try {
        const axios = require('axios');
        const testPrompt = 'a cute cat';
        
        const headers = {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
        };
        
        const requestData = {
            model: model.model,
            prompt: testPrompt,
            n: 1,
            size: '512x512',
            response_format: 'url'
        };
        
        console.log(`🎨 测试图像模型: ${model.name}`);
        
        const startTime = Date.now();
        const response = await axios.post(
            `${model.baseURL}/images/generations`,
            requestData,
            { headers, timeout: 60000 }
        );
        
        const responseTime = Date.now() - startTime;
        const imageUrl = response.data.data?.[0]?.url;
        
        return {
            success: true,
            message: `图像模型测试成功`,
            data: {
                modelType: 'image',
                imageUrl,
                responseTime,
                prompt: testPrompt
            }
        };
    } catch (error) {
        return {
            success: false,
            message: `图像模型测试失败: ${error.message}`,
            error: error.message
        };
    }
}

// ==================== AI生成功能 ====================

// AI生成用户 - 管理面板需要
router.post('/generate/users', authenticateToken, async (req, res) => {
    try {
        const { modelId, count, previewOnly } = req.body;
        
        if (!modelId || !count || count < 1) {
            return res.status(400).json({
                success: false,
                message: '参数无效'
            });
        }

        if (count > 20) {
            return res.status(400).json({
                success: false,
                message: '单次生成用户数量不能超过20个'
            });
        }

        console.log('🤖 AI生成用户请求:', { modelId, count, previewOnly });

        // 获取AI模型信息
        const { data: modelData } = await db.collection('AI_Model').doc(modelId).get();
        
        let model = null;
        if (Array.isArray(modelData) && modelData.length > 0) {
            model = modelData[0];
        } else if (modelData && !Array.isArray(modelData)) {
            model = modelData;
        }

        if (!model || !model.isActive) {
            return res.status(400).json({
                success: false,
                message: '选择的AI模型无效或已禁用'
            });
        }

        // 调用AI服务生成用户数据
        const generatedUsers = await generateUsersWithAI(model, count);

        if (previewOnly) {
            // 仅预览模式
            res.json({
                success: true,
                data: {
                    generatedUsers,
                    count: generatedUsers.length,
                    previewOnly: true
                },
                message: `AI生成了 ${generatedUsers.length} 个用户预览`
            });
        } else {
            // 直接保存到数据库
            const savedUsers = [];
            for (const user of generatedUsers) {
                try {
                    const result = await db.collection('user_profile').add(user);
                    savedUsers.push({ ...user, _id: result.id });
                } catch (error) {
                    console.error('保存生成用户失败:', error);
                }
            }

            res.json({
                success: true,
                data: {
                    savedUsers,
                    count: savedUsers.length
                },
                message: `AI生成并保存了 ${savedUsers.length} 个用户`
            });
        }
    } catch (error) {
        console.error('AI生成用户失败:', error);
        res.status(500).json({
            success: false,
            message: 'AI生成用户失败: ' + error.message
        });
    }
});

// AI生成帖文 - 管理面板需要
router.post('/generate/posts', authenticateToken, async (req, res) => {
    try {
        const { modelId, count, topic, authorId, previewOnly, enableImageGeneration, selectedImageModel } = req.body;
        
        if (!modelId || !count || count < 1) {
            return res.status(400).json({
                success: false,
                message: '参数无效'
            });
        }

        if (count > 15) {
            return res.status(400).json({
                success: false,
                message: '单次生成帖文数量不能超过15个'
            });
        }

        console.log('🤖 AI生成帖文请求:', { modelId, count, topic, authorId, previewOnly, enableImageGeneration, selectedImageModel });

        // 获取文本模型信息
        const { data: modelData } = await db.collection('AI_Model').doc(modelId).get();
        
        let textModel = null;
        if (Array.isArray(modelData) && modelData.length > 0) {
            textModel = modelData[0];
        } else if (modelData && !Array.isArray(modelData)) {
            textModel = modelData;
        }

        if (!textModel || !textModel.isActive) {
            return res.status(400).json({
                success: false,
                message: '选择的文本模型无效或已禁用'
            });
        }

        // 如果启用图像生成，获取图像模型信息
        let imageModel = null;
        if (enableImageGeneration && selectedImageModel) {
            const { data: imageModelData } = await db.collection('AI_Model').doc(selectedImageModel).get();
            
            if (Array.isArray(imageModelData) && imageModelData.length > 0) {
                imageModel = imageModelData[0];
            } else if (imageModelData && !Array.isArray(imageModelData)) {
                imageModel = imageModelData;
            }
        }

        // 调用AI服务生成帖文数据
        const generatedPosts = await generatePostsWithAI(textModel, count, topic, authorId, imageModel);

        if (previewOnly) {
            // 仅预览模式
            res.json({
                success: true,
                data: {
                    generatedPosts,
                    count: generatedPosts.length,
                    previewOnly: true,
                    imageGenerationEnabled: !!imageModel,
                    imagesGenerated: generatedPosts.filter(post => post.images && post.images.length > 0).length
                },
                message: `AI生成了 ${generatedPosts.length} 个帖文预览`
            });
        } else {
            // 直接保存到数据库
            const savedPosts = [];
            for (const post of generatedPosts) {
                try {
                    const result = await db.collection('ai_post').add(post);
                    savedPosts.push({ ...post, _id: result.id });
                } catch (error) {
                    console.error('保存生成帖文失败:', error);
                }
            }

            res.json({
                success: true,
                data: {
                    savedPosts,
                    count: savedPosts.length,
                    imageGenerationEnabled: !!imageModel,
                    imagesGenerated: savedPosts.filter(post => post.images && post.images.length > 0).length
                },
                message: `AI生成并保存了 ${savedPosts.length} 个帖文`
            });
        }
    } catch (error) {
        console.error('AI生成帖文失败:', error);
        res.status(500).json({
            success: false,
            message: 'AI生成帖文失败: ' + error.message
        });
    }
});

// AI生成用户实现函数
async function generateUsersWithAI(model, count) {
    console.log('🤖 开始使用AI模型生成用户:', { model: model.name, count });
    
    const users = [];
    const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都', '重庆', '天津'];
    const provinces = {
        '北京': '北京市',
        '上海': '上海市', 
        '广州': '广东省',
        '深圳': '广东省',
        '杭州': '浙江省',
        '南京': '江苏省',
        '武汉': '湖北省',
        '成都': '四川省',
        '重庆': '重庆市',
        '天津': '天津市'
    };

    // 导入PetMeetID生成函数
    const { generateCompactPetMeetID } = require('../utils/idMapping');

    /**
     * 生成微信openid格式的ID
     * 格式：o + 基础字符 + 22位随机字符
     * 示例：oK4cF7BXUaKgYPItC7lO245TxSe0d
     */
    function generateWeChatOpenId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'o'; // 微信openid固定以'o'开头
        
        // 生成27位随机字符（包括开头的'o'一共28位）
        for (let i = 0; i < 27; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    }

    for (let i = 0; i < count; i++) {
        try {
            const selectedCity = cities[Math.floor(Math.random() * cities.length)];
            const selectedProvince = provinces[selectedCity];
            
            const prompt = `请生成一个宠物爱好者的用户信息，要求返回JSON格式：

{
  "nickName": "适合宠物社区的昵称，5-12个字符",
  "bio": "个人简介，20-50字，体现对宠物的热爱",
  "gender": "male或female之一",
  "city": "${selectedCity}",
  "province": "${selectedProvince}",
  "birthday": "1985-2005年间的生日，格式YYYY-MM-DD"
}

请确保昵称有创意且与宠物相关，个人简介真实自然。只返回JSON，不要其他内容。`;

            console.log(`🤖 [${i+1}/${count}] 调用AI生成用户...`);
            
            // 调用AI模型
            const axios = require('axios');
            const headers = {
                'Authorization': `Bearer ${model.apiKey}`,
                'Content-Type': 'application/json'
            };
            
            const requestData = {
                model: model.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
                temperature: 0.8
            };
            
            const aiResponse = await axios.post(
                `${model.baseURL}/chat/completions`,
                requestData,
                { headers, timeout: 120000 } // 用户生成增加到120秒
            );
            
            if (!aiResponse.data?.choices?.[0]?.message?.content) {
                throw new Error('AI模型返回数据格式错误');
            }
            
            const content = aiResponse.data.choices[0].message.content.trim();
            console.log(`🤖 [${i+1}/${count}] AI原始回复:`, content);
            
            // 解析JSON
            let userInfo;
            try {
                // 尝试提取JSON
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    userInfo = JSON.parse(jsonMatch[0]);
                } else {
                    userInfo = JSON.parse(content);
                }
            } catch (parseError) {
                console.error(`❌ [${i+1}/${count}] JSON解析失败:`, parseError.message);
                // 降级处理：使用默认数据
                userInfo = {
                    nickName: `宠物达人${Math.floor(1000 + Math.random() * 9000)}`,
                    bio: '热爱宠物，乐于分享养宠经验',
                    gender: Math.random() > 0.5 ? 'male' : 'female',
                    city: selectedCity,
                    province: selectedProvince,
                    birthday: `${1985 + Math.floor(Math.random() * 20)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
                };
            }
            
            // 验证数据完整性
            if (!userInfo.nickName || !userInfo.bio || !userInfo.gender || !userInfo.city || !userInfo.birthday) {
                console.warn(`⚠️ [${i+1}/${count}] AI生成数据不完整，使用默认数据`);
                userInfo = {
                    nickName: userInfo.nickName || `宠物爱好者${Math.floor(1000 + Math.random() * 9000)}`,
                    bio: userInfo.bio || '热爱宠物生活，享受与毛孩子们的美好时光',
                    gender: userInfo.gender || (Math.random() > 0.5 ? 'male' : 'female'),
                    city: userInfo.city || selectedCity,
                    province: userInfo.province || selectedProvince,
                    birthday: userInfo.birthday || `${1985 + Math.floor(Math.random() * 20)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
                };
            }
            
            const now = new Date().toISOString();
            // 生成标准微信openid格式
            const userId = generateWeChatOpenId();
            
            // 使用后端方法生成PetMeetID
            let petMeetID;
            try {
                petMeetID = await generateCompactPetMeetID(userId);
                console.log(`✅ [${i+1}/${count}] 生成PetMeetID成功: ${petMeetID}`);
            } catch (petMeetIdError) {
                console.error(`❌ [${i+1}/${count}] 生成PetMeetID失败:`, petMeetIdError.message);
                // 降级使用简单格式（保持原逻辑作为备用）
                petMeetID = `PM${Math.floor(100000 + Math.random() * 900000)}`;
            }
            
            const user = {
                _openid: userId,
                nickName: userInfo.nickName,
                bio: userInfo.bio,
                gender: userInfo.gender,
                city: userInfo.city,
                province: userInfo.province,
                birthday: userInfo.birthday,
                avatarUrl: `https://via.placeholder.com/100x100?text=${encodeURIComponent(userInfo.nickName.charAt(0))}`,
                status: 'active',
                isAIGenerated: true,
                aiModel: model.name,
                createTime: now,
                updateTime: now,
                createdAt: new Date(),
                updatedAt: new Date(),
                PetMeetID: petMeetID
            };
            
            users.push(user);
            console.log(`✅ [${i+1}/${count}] 用户生成成功:`, userInfo.nickName, `openid: ${userId}, PetMeetID: ${petMeetID}`);
            
            // 避免API调用过快
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error(`❌ [${i+1}/${count}] 生成用户失败:`, error.message);
            // 降级处理：生成默认用户
            const now = new Date().toISOString();
            const userId = generateWeChatOpenId();
            const selectedCity = cities[Math.floor(Math.random() * cities.length)];
            
            // 降级时也尝试生成PetMeetID
            let petMeetID;
            try {
                petMeetID = await generateCompactPetMeetID(userId);
            } catch (petMeetIdError) {
                petMeetID = `PM${Math.floor(100000 + Math.random() * 900000)}`;
            }
            
            users.push({
                _openid: userId,
                nickName: `宠物爱好者${Math.floor(1000 + Math.random() * 9000)}`,
                bio: '热爱宠物，乐于分享经验',
                gender: Math.random() > 0.5 ? 'male' : 'female',
                city: selectedCity,
                province: provinces[selectedCity],
                birthday: `${1985 + Math.floor(Math.random() * 20)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                avatarUrl: 'https://via.placeholder.com/100x100?text=U',
                status: 'active',
                isAIGenerated: true,
                aiModel: model.name,
                createTime: now,
                updateTime: now,
                createdAt: new Date(),
                updatedAt: new Date(),
                PetMeetID: petMeetID
            });
        }
    }

    console.log(`🎉 AI用户生成完成，成功生成 ${users.length}/${count} 个用户`);
    return users;
}

// AI生成帖文实现函数
async function generatePostsWithAI(textModel, count, topic, authorId, imageModel) {
    console.log('🤖 开始使用AI模型生成帖文:', { 
        textModel: textModel.name, 
        count, 
        topic, 
        imageModel: imageModel?.name || '无' 
    });
    
    const posts = [];
    const categories = ['经验分享', '问题求助', '日常分享', '科普知识', '产品推荐'];
    
    // 准备图像生成服务（如果需要）
    const aiService = require('../services/aiService');
    
    for (let i = 0; i < count; i++) {
        try {
            // 构建帖文生成提示词
            const topicHint = topic ? `主题：${topic}` : '主题：随机宠物相关话题';
            const prompt = `请生成一篇宠物社区帖文，要求返回JSON格式：

${topicHint}

{
  "title": "吸引人的标题，8-20个字符",
  "content": "帖文主要内容，80-200字，真实自然",
  "longPost": "详细内容，200-500字，包含具体经验或建议",
  "topics": ["相关标签1", "相关标签2", "相关标签3"],
  "category": "从${categories.join('、')}中选择一个",
  "imagePrompt": "如果内容适合配图，提供英文图像生成提示词，20-50个单词"
}

要求：
1. 内容要真实自然，符合宠物爱好者的语言风格
2. 包含具体的经验、建议或故事
3. 标签要相关且实用
4. 图像提示词要与内容高度相关，适合生成宠物相关图片

只返回JSON，不要其他内容。`;

            console.log(`🤖 [${i+1}/${count}] 调用AI生成帖文...`);
            
            // 调用AI模型生成文本内容
            const axios = require('axios');
            const headers = {
                'Authorization': `Bearer ${textModel.apiKey}`,
                'Content-Type': 'application/json'
            };
            
            const requestData = {
                model: textModel.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.8
            };
            
            const aiResponse = await axios.post(
                `${textModel.baseURL}/chat/completions`,
                requestData,
                { headers, timeout: 120000 } // 帖文生成增加到120秒，内容更复杂需要更长时间
            );
            
            if (!aiResponse.data?.choices?.[0]?.message?.content) {
                throw new Error('AI模型返回数据格式错误');
            }
            
            const content = aiResponse.data.choices[0].message.content.trim();
            console.log(`🤖 [${i+1}/${count}] AI帖文回复:`, content.substring(0, 100) + '...');
            
            // 解析JSON
            let postInfo;
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    postInfo = JSON.parse(jsonMatch[0]);
                } else {
                    postInfo = JSON.parse(content);
                }
            } catch (parseError) {
                console.error(`❌ [${i+1}/${count}] 帖文JSON解析失败:`, parseError.message);
                // 降级处理
                const topicKeywords = topic ? [topic] : ['宠物健康', '宠物训练', '宠物美食', '宠物玩耍', '宠物护理'];
                const selectedTopic = topicKeywords[Math.floor(Math.random() * topicKeywords.length)];
                
                postInfo = {
                    title: `关于${selectedTopic}的分享`,
                    content: `分享一些关于${selectedTopic}的经验和心得`,
                    longPost: `详细分享关于${selectedTopic}的实用建议和注意事项，希望对大家有帮助`,
                    topics: [selectedTopic, '经验分享'],
                    category: categories[Math.floor(Math.random() * categories.length)],
                    imagePrompt: `A cute pet related to ${selectedTopic}`
                };
            }
            
            // 验证和补充数据
            if (!postInfo.title) postInfo.title = `宠物分享 ${i + 1}`;
            if (!postInfo.content) postInfo.content = '分享一些养宠心得';
            if (!postInfo.longPost) postInfo.longPost = postInfo.content;
            if (!Array.isArray(postInfo.topics)) postInfo.topics = ['宠物', '分享'];
            if (!postInfo.category || !categories.includes(postInfo.category)) {
                postInfo.category = categories[Math.floor(Math.random() * categories.length)];
            }
            
            const now = new Date().toISOString();
            const currentDate = new Date(); // 添加统一的时间对象
            // 确保有有效的作者信息和用户信息
            let postAuthorId = authorId || 'ai_system';
            let postOpenId = 'ai_system'; // 设置默认的_openid
            let authorInfo = {
                nickName: '系统用户',
                avatarUrl: 'https://via.placeholder.com/100x100?text=AI'
            };
            
            // 如果提供了真实的authorId，尝试获取对应的用户信息
            if (authorId && authorId !== 'ai_system') {
                try {
                    const { data: users } = await db.collection('user_profile').get();
                    const author = users.find(u => u._id === authorId || u._openid === authorId);
                    if (author) {
                        postOpenId = author._openid;
                        postAuthorId = author._id;
                        authorInfo = {
                            nickName: author.nickName || '匿名用户',
                            avatarUrl: author.avatarUrl || 'https://via.placeholder.com/100x100?text=User'
                        };
                        console.log(`✅ [${i+1}/${count}] 使用作者信息:`, authorInfo.nickName);
                    }
                } catch (error) {
                    console.warn(`获取作者信息失败，使用默认值: ${error.message}`);
                }
            }
            
            const post = {
                _openid: postOpenId, // 添加_openid字段
                userInfo: authorInfo, // 添加完整的用户信息
                title: postInfo.title,
                content: postInfo.content,
                longPost: postInfo.longPost,
                authorId: postAuthorId,
                topics: postInfo.topics,
                category: postInfo.category,
                location: null,
                permission: 'public', // 固定为public权限
                contentType: 'standard',
                status: 'approved',
                images: [],
                // 统一使用服务器时间格式，与手动创建帖文保持一致
                createTime: db.serverDate(),
                updateTime: db.serverDate(),
                createdAt: db.serverDate(),
                updatedAt: db.serverDate(),
                likeCount: Math.floor(Math.random() * 50),
                commentCount: Math.floor(Math.random() * 20),
                shareCount: Math.floor(Math.random() * 10),
                likes: Math.floor(Math.random() * 50),
                comments: Math.floor(Math.random() * 20),
                shares: Math.floor(Math.random() * 10)
            };
            
            // 如果启用了图像生成且有提示词
            if (imageModel && postInfo.imagePrompt) {
                try {
                    console.log(`🎨 [${i+1}/${count}] 开始生成图像...`);
                    const imageResult = await aiService.generateImage({
                        prompt: postInfo.imagePrompt,
                        model: imageModel.model,
                        size: "1024x1024",
                        baseURL: imageModel.baseURL,
                        apiKey: imageModel.apiKey  // 直接传入API密钥
                    });
                    
                    if (imageResult?.data?.[0]?.url) {
                        post.images = [imageResult.data[0].url];
                        console.log(`✅ [${i+1}/${count}] 图像生成成功`);
                    }
                } catch (imageError) {
                    console.error(`❌ [${i+1}/${count}] 图像生成失败:`, imageError.message);
                    // 图像生成失败不影响帖文创建
                }
            }
            
            posts.push(post);
            console.log(`✅ [${i+1}/${count}] 帖文生成成功:`, postInfo.title, `作者: ${authorInfo.nickName}`);
            
            // 避免API调用过快
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.error(`❌ [${i+1}/${count}] 生成帖文失败:`, error.message);
            
            // 降级处理：生成默认帖文
            const topicKeywords = topic ? [topic] : ['宠物健康', '宠物训练', '宠物美食', '宠物玩耍', '宠物护理'];
            const selectedTopic = topicKeywords[Math.floor(Math.random() * topicKeywords.length)];
            const now = new Date().toISOString();
            const currentDate = new Date(); // 添加统一的时间对象
            
            // 确保降级处理也有正确的_openid和用户信息
            let postAuthorId = authorId || 'ai_system';
            let postOpenId = 'ai_system';
            let authorInfo = {
                nickName: '系统用户',
                avatarUrl: 'https://via.placeholder.com/100x100?text=AI'
            };
            
            if (authorId && authorId !== 'ai_system') {
                try {
                    const { data: users } = await db.collection('user_profile').get();
                    const author = users.find(u => u._id === authorId || u._openid === authorId);
                    if (author) {
                        postOpenId = author._openid;
                        postAuthorId = author._id;
                        authorInfo = {
                            nickName: author.nickName || '匿名用户',
                            avatarUrl: author.avatarUrl || 'https://via.placeholder.com/100x100?text=User'
                        };
                    }
                } catch (error) {
                    console.warn(`获取作者信息失败，使用默认值: ${error.message}`);
                }
            }
            
            posts.push({
                _openid: postOpenId, // 添加_openid字段
                userInfo: authorInfo, // 添加完整的用户信息
                title: `关于${selectedTopic}的分享 ${i + 1}`,
                content: `这是一篇关于${selectedTopic}的分享，包含了相关的经验和建议。`,
                longPost: `详细内容：关于${selectedTopic}的详细分享，包含了专业的建议和实用的技巧。`,
                authorId: postAuthorId,
                topics: [selectedTopic, '经验分享'],
                category: categories[Math.floor(Math.random() * categories.length)],
                location: null,
                permission: 'public', // 固定为public权限
                contentType: 'standard',
                status: 'approved',
                images: [],
                // 统一使用服务器时间格式，与手动创建帖文保持一致
                createTime: db.serverDate(),
                updateTime: db.serverDate(),
                createdAt: db.serverDate(),
                updatedAt: db.serverDate(),
                likeCount: Math.floor(Math.random() * 50),
                commentCount: Math.floor(Math.random() * 20),
                shareCount: Math.floor(Math.random() * 10),
                likes: Math.floor(Math.random() * 50),
                comments: Math.floor(Math.random() * 20),
                shares: Math.floor(Math.random() * 10)
            });
        }
    }

    console.log(`🎉 AI帖文生成完成，成功生成 ${posts.length}/${count} 个帖文`);
    return posts;
}

// 创建帖文 - 调用postController的createPost方法
router.post('/posts', authenticateToken, async (req, res) => {
    try {
        console.log(`🆕 管理员创建帖文`);
        
        // 修正数据格式：postController期望数据在req.body.post字段中
        if (!req.body.post) {
            // 如果管理面板直接发送帖文数据，包装到post字段中
            req.body = {
                post: req.body
            };
        }
        
        // 调用现有的postController.createPost方法
        const postController = require('../controllers/postController');
        await postController.createPost(req, res);
        
    } catch (error) {
        console.error('创建帖文失败:', error);
        res.status(500).json({
            success: false,
            message: '创建帖文失败: ' + error.message
        });
    }
});

// 删除帖文 - 调用postController的deletePost方法
router.delete('/posts/:id', authenticateToken, async (req, res) => {
    try {
        console.log(`🗑️ 管理员删除帖文: ${req.params.id}`);
        
        // 重新设置参数名以匹配postController的期望
        req.params.postId = req.params.id;
        
        // 调用现有的postController.deletePost方法
        const postController = require('../controllers/postController');
        await postController.deletePost(req, res);
        
    } catch (error) {
        console.error('删除帖文失败:', error);
        res.status(500).json({
            success: false,
            message: '删除帖文失败: ' + error.message
        });
    }
});

// 更新帖文 - 调用postController的updatePost方法
router.put('/posts/:id', authenticateToken, async (req, res) => {
    try {
        console.log(`📝 管理员更新帖文: ${req.params.id}`);
        
        // 重新设置参数名以匹配postController的期望
        req.params.postId = req.params.id;
        
        // 修正数据格式：postController期望数据在req.body字段中（不是post子字段）
        // 调用现有的postController.updatePost方法
        const postController = require('../controllers/postController');
        await postController.updatePost(req, res);
        
    } catch (error) {
        console.error('更新帖文失败:', error);
        res.status(500).json({
            success: false,
            message: '更新帖文失败: ' + error.message
        });
    }
});

// 创建AI模型 - 后端暂无此功能
router.post('/ai-models', authenticateToken, async (req, res) => {
    try {
        console.log('🆕 管理面板创建AI模型');
        
        const { name, description, version, status, apiKey, endpoint, type, provider, model, baseURL, config } = req.body;
        
        if (!name || !type || !provider || !model || !baseURL) {
            return res.status(400).json({
                success: false,
                message: '必填字段不能为空 (name, type, provider, model, baseURL)'
            });
        }

        // 创建AI模型数据
        const aiModelData = {
            name,
            description: description || '',
            version: version || '1.0.0',
            status: status || 'active',
            isActive: status === 'active',
            apiKey: apiKey || '',
            endpoint: endpoint || '',
            type,
            provider,
            model,
            baseURL,
            config: config || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            testStatus: 'untested',
            lastTestTime: null,
            lastTestError: null
        };

        // 保存到数据库
        const result = await db.collection('AI_Model').add(aiModelData);
        
        // 返回创建的模型数据
        const createdModel = {
            _id: result.id,
            ...aiModelData
        };

        console.log('✅ AI模型创建成功:', createdModel.name);
        
        res.json({
            success: true,
            data: createdModel,
            message: 'AI模型创建成功'
        });
    } catch (error) {
        console.error('创建AI模型失败:', error);
        res.status(500).json({
            success: false,
            message: '创建AI模型失败: ' + error.message
        });
    }
});

// ==================== 宠物信息管理 ====================

// 测试ai_pet集合访问 - 调试用
router.get('/test-pet-collection', authenticateToken, async (req, res) => {
    try {
        console.log('🧪 测试ai_pet集合访问...');
        
        // 测试基本访问
        const result = await db.collection('ai_pet').limit(1).get();
        console.log('🧪 ai_pet基本查询结果:', result.data.length);
        
        // 测试user_profile访问
        const userResult = await db.collection('user_profile').limit(1).get();
        console.log('🧪 user_profile查询结果:', userResult.data.length);
        
        res.json({
            success: true,
            data: {
                ai_pet_count: result.data.length,
                user_profile_count: userResult.data.length,
                ai_pet_sample: result.data[0] || null
            },
            message: '集合访问测试成功'
        });
    } catch (error) {
        console.error('🧪 集合访问测试失败:', error);
        res.status(500).json({
            success: false,
            message: '集合访问测试失败: ' + error.message,
            error_code: error.code,
            error_details: error.stack
        });
    }
});

// 获取用户的所有宠物 - 从ai_pet集合
router.get('/users/:userId/pets', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🐾 获取用户宠物列表:', userId);
        
        // 获取用户信息以获取其_openid或PetMeetID - 修正：使用user_profile集合
        const userResult = await db.collection('user_profile').doc(userId).get();
        console.log('🐾 用户查询结果:', { hasData: !!userResult.data, dataType: typeof userResult.data });
        
        // CloudBase的doc().get()返回的data可能是数组格式，需要正确解析
        let userData = null;
        if (Array.isArray(userResult.data) && userResult.data.length > 0) {
            userData = userResult.data[0];
        } else if (userResult.data && !Array.isArray(userResult.data)) {
            userData = userResult.data;
        }
        
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        console.log('🐾 用户数据:', { _openid: userData._openid, PetMeetID: userData.PetMeetID });
        
        // 构建查询条件 - 优先使用_openid
        let whereQuery = {};
        if (userData._openid) {
            whereQuery._openid = userData._openid;
        } else if (userData.PetMeetID) {
            whereQuery.PetMeetID = userData.PetMeetID;
        } else {
            whereQuery.ownerId = userId; // 备用查询方式
        }
        
        console.log('🐾 宠物查询条件:', whereQuery);
        
        // 移除orderBy避免索引问题，先进行基本查询
        const petsResult = await db.collection('ai_pet')
            .where(whereQuery)
            .get();
        
        const pets = petsResult.data || [];
        
        // 转换数据格式以匹配前端期望的字段
        const transformedPets = pets.map(pet => {
            // 解析年龄（从生日计算或直接使用age字段）
            let age = pet.age || '';
            if (!age && pet.birthDate) {
                try {
                    const birthDate = new Date(pet.birthDate);
                    const now = new Date();
                    const ageInYears = now.getFullYear() - birthDate.getFullYear();
                    const monthDiff = now.getMonth() - birthDate.getMonth();
                    
                    if (ageInYears > 0) {
                        age = `${ageInYears}岁`;
                        if (monthDiff > 0) {
                            age += `${monthDiff}个月`;
                        }
                    } else if (monthDiff > 0) {
                        age = `${monthDiff}个月`;
                    } else {
                        const dayDiff = Math.floor((now - birthDate) / (1000 * 60 * 60 * 24));
                        if (dayDiff > 0) {
                            age = `${dayDiff}天`;
                        }
                    }
                } catch (e) {
                    console.warn('计算年龄失败:', e.message);
                }
            }
            
            // 解析品种（从species字段中提取）
            let category = '';
            let breed = '';
            if (pet.species) {
                const parts = pet.species.split(' - ');
                if (parts.length > 1) {
                    category = parts[0].trim(); // 例如："猫"
                    breed = parts[1].trim();    // 例如："英国短毛猫"
                } else {
                    category = pet.species;
                }
            }
            
            return {
                _id: pet._id,
                name: pet.nickname || pet.name || '未命名',
                category: category || pet.category || '',
                breed: breed || pet.breed || '',
                age: age,
                gender: pet.gender || '',
                weight: pet.weight ? `${pet.weight}kg` : '',
                birthDate: pet.birthDate || '',
                description: pet.description || pet.bio || '',
                vaccinated: pet.vaccinated || false,
                neutered: pet.neutered || false,
                avatarUrl: pet.avatarUrl || '',
                // 保留原始字段以备需要
                _openid: pet._openid,
                openid: pet.openid,
                createdAt: pet.createdAt,
                updatedAt: pet.updatedAt
            };
        });
        
        // 在内存中排序（如果需要的话）
        if (transformedPets.length > 0) {
            transformedPets.sort((a, b) => {
                const aTime = new Date(a.createdAt || 0);
                const bTime = new Date(b.createdAt || 0);
                return bTime - aTime; // 降序排列
            });
        }
        
        console.log(`✅ 获取到${transformedPets.length}只宠物，已转换格式`);
        
        res.json({
            success: true,
            data: transformedPets,
            total: transformedPets.length,
            message: `获取宠物列表成功，共${transformedPets.length}只宠物`
        });
    } catch (error) {
        console.error('获取用户宠物列表失败:', error);
        console.error('错误详情:', error.stack);
        res.status(500).json({
            success: false,
            message: '获取宠物列表失败: ' + error.message
        });
    }
});

// 创建宠物信息 - 保存到ai_pet集合
router.post('/users/:userId/pets', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const petData = req.body;
        
        console.log('🐾 创建宠物信息:', userId, petData);
        
        if (!petData.name || !petData.category) {
            return res.status(400).json({
                success: false,
                message: '宠物名称和类别是必需的'
            });
        }
        
        // 获取用户信息 - 修正：使用user_profile集合
        const userResult = await db.collection('user_profile').doc(userId).get();
        
        // CloudBase的doc().get()返回的data可能是数组格式，需要正确解析
        let userData = null;
        if (Array.isArray(userResult.data) && userResult.data.length > 0) {
            userData = userResult.data[0];
        } else if (userResult.data && !Array.isArray(userResult.data)) {
            userData = userResult.data;
        }
        
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 转换前端字段为数据库格式
        const species = petData.breed ? 
            `${petData.category} - ${petData.breed}` : 
            petData.category;
        
        // 处理体重格式
        let weight = petData.weight;
        if (weight && typeof weight === 'string') {
            weight = weight.replace('kg', '').trim();
        }
        
        // 构建宠物数据 - 使用数据库字段格式
        const petRecord = {
            // 前端字段 -> 数据库字段映射
            nickname: petData.name,           // name -> nickname
            species: species,                 // category + breed -> species
            gender: petData.gender,          // gender -> gender
            weight: weight,                  // weight -> weight (去掉kg)
            birthDate: petData.birthDate,    // birthDate -> birthDate
            bio: petData.description,        // description -> bio
            
            // 额外字段
            ownerId: userId,
            ownerInfo: {
                _id: userId,
                nickName: userData.nickName,
                PetMeetID: userData.PetMeetID
            },
            // 兼容性字段
            _openid: userData._openid,
            PetMeetID: userData.PetMeetID,
            vaccinated: petData.vaccinated || false,
            neutered: petData.neutered || false,
            avatarUrl: petData.avatarUrl || '',
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
        };
        
        const result = await db.collection('ai_pet').add(petRecord);
        
        console.log('✅ 宠物创建成功:', result._id);
        
        // 返回转换为前端格式的数据
        const responseData = {
            _id: result._id,
            name: petRecord.nickname,
            category: petData.category,
            breed: petData.breed || '',
            age: petData.age || '',
            gender: petRecord.gender,
            weight: petRecord.weight ? `${petRecord.weight}kg` : '',
            birthDate: petRecord.birthDate,
            description: petRecord.bio || '',
            vaccinated: petRecord.vaccinated,
            neutered: petRecord.neutered,
            avatarUrl: petRecord.avatarUrl,
            _openid: petRecord._openid,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        res.json({
            success: true,
            data: responseData,
            message: '宠物信息创建成功'
        });
    } catch (error) {
        console.error('创建宠物信息失败:', error);
        res.status(500).json({
            success: false,
            message: '创建宠物信息失败: ' + error.message
        });
    }
});

// 更新宠物信息
router.put('/pets/:petId', authenticateToken, async (req, res) => {
    try {
        const { petId } = req.params;
        const petData = req.body;
        
        console.log('🐾 更新宠物信息:', petId, petData);
        
        // 转换前端字段为数据库格式
        const species = petData.breed ? 
            `${petData.category} - ${petData.breed}` : 
            petData.category;
        
        // 处理体重格式
        let weight = petData.weight;
        if (weight && typeof weight === 'string') {
            weight = weight.replace('kg', '').trim();
        }
        
        // 准备更新数据 - 字段转换
        const updateData = {
            // 前端字段 -> 数据库字段映射
            nickname: petData.name,           // name -> nickname
            species: species,                 // category + breed -> species
            gender: petData.gender,          // gender -> gender
            weight: weight,                  // weight -> weight (去掉kg)
            birthDate: petData.birthDate,    // birthDate -> birthDate
            bio: petData.description,        // description -> bio
            vaccinated: petData.vaccinated || false,
            neutered: petData.neutered || false,
            avatarUrl: petData.avatarUrl || '',
            updatedAt: db.serverDate()
        };
        
        // 移除空值和不需要的字段
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined || updateData[key] === null) {
                delete updateData[key];
            }
        });
        
        // 移除不允许更新的字段
        delete updateData._id;
        delete updateData.ownerId;
        delete updateData._openid;
        delete updateData.PetMeetID;
        delete updateData.createdAt;
        
        const result = await db.collection('ai_pet').doc(petId).update(updateData);
        
        console.log('✅ 宠物更新成功');
        
        // 获取更新后的宠物信息并转换格式
        const updatedPet = await db.collection('ai_pet').doc(petId).get();
        let pet = null;
        if (Array.isArray(updatedPet.data) && updatedPet.data.length > 0) {
            pet = updatedPet.data[0];
        } else if (updatedPet.data && !Array.isArray(updatedPet.data)) {
            pet = updatedPet.data;
        }
        
        // 转换为前端格式返回
        const responseData = pet ? {
            _id: petId,
            name: pet.nickname || '未命名',
            category: petData.category || '',
            breed: petData.breed || '',
            age: petData.age || '',
            gender: pet.gender || '',
            weight: pet.weight ? `${pet.weight}kg` : '',
            birthDate: pet.birthDate || '',
            description: pet.bio || '',
            vaccinated: pet.vaccinated || false,
            neutered: pet.neutered || false,
            avatarUrl: pet.avatarUrl || '',
            _openid: pet._openid,
            createdAt: pet.createdAt,
            updatedAt: pet.updatedAt
        } : { _id: petId };
        
        res.json({
            success: true,
            data: responseData,
            message: '宠物信息更新成功'
        });
    } catch (error) {
        console.error('更新宠物信息失败:', error);
        res.status(500).json({
            success: false,
            message: '更新宠物信息失败: ' + error.message
        });
    }
});

// 删除宠物信息
router.delete('/pets/:petId', authenticateToken, async (req, res) => {
    try {
        const { petId } = req.params;
        
        console.log('🐾 删除宠物信息:', petId);
        
        // 先检查宠物是否存在
        const pet = await db.collection('ai_pet').doc(petId).get();
        if (!pet.data) {
            return res.status(404).json({
                success: false,
                message: '宠物信息不存在'
            });
        }
        
        await db.collection('ai_pet').doc(petId).remove();
        
        console.log('✅ 宠物删除成功');
        
        res.json({
            success: true,
            message: '宠物信息删除成功'
        });
    } catch (error) {
        console.error('删除宠物信息失败:', error);
        res.status(500).json({
            success: false,
            message: '删除宠物信息失败: ' + error.message
        });
    }
});

// 获取单个宠物详情
router.get('/pets/:petId', authenticateToken, async (req, res) => {
    try {
        const { petId } = req.params;
        
        console.log('🐾 获取宠物详情:', petId);
        
        const pet = await db.collection('ai_pet').doc(petId).get();
        
        if (!pet.data) {
            return res.status(404).json({
                success: false,
                message: '宠物信息不存在'
            });
        }
        
        res.json({
            success: true,
            data: pet.data,
            message: '获取宠物详情成功'
        });
    } catch (error) {
        console.error('获取宠物详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取宠物详情失败: ' + error.message
        });
    }
});

module.exports = router; 