const { getDatabase } = require('../config/cloudbaseConfig');
const { instance: snowflake, generate: generateSnowflakeId } = require('../utils/snowflake');
const { generateCompactPetMeetID } = require('../utils/idMapping');
const db = getDatabase();
const _ = db.command;
const jwt = require('jsonwebtoken');

// 生成 JWT token
const generateToken = (authUser) => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const expiresIn = '7d'; // token 7天后过期
  
  return jwt.sign(
    { 
      userId: authUser._id,
      openid: authUser._id, // 为了向后兼容，同时设置openid
      nickName: authUser.nickName,
      PetMeetID: authUser.PetMeetID,
      role: authUser.role || 'user'
    },
    secret,
    { expiresIn }
  );
};

// 创建验证码缓存
const verificationCodes = {};

/**
 * 生成随机验证码
 * @param {Number} length 验证码长度
 * @returns {String} 验证码
 */
const generateVerificationCode = (length = 6) => {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
};

/**
 * 生成唯一的PetMeetID（使用映射表9位短码）
 * @param {String} userId 用户ID，通常是openID
 * @returns {Promise<String>} 9位数字ID
 */
const generatePetMeetID = async (userId) => {
  // 调用ID映射工具生成9位数字ID
  // 生成的ID将保存在映射表中，可以随时查询原始雪花ID和对应的用户ID
  return await generateCompactPetMeetID(userId);
};

/**
 * 发送验证码
 * 在实际生产环境中，应该调用短信服务API发送验证码
 * 这里简化为将验证码存储在内存中
 */
const sendVerificationCode = async (req, res) => {
  try {
    const { phone } = req.body;
    
    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '无效的手机号码'
      });
    }
    
    // 生成验证码
    const code = generateVerificationCode();
    
    // 保存验证码，设置5分钟过期
    verificationCodes[phone] = {
      code,
      expireAt: Date.now() + 5 * 60 * 1000
    };
    
    console.log(`为手机号 ${phone} 生成验证码: ${code}`);
    
    // 实际生产环境应当调用短信API发送验证码
    // 这里返回验证码仅用于测试目的
    return res.status(200).json({
      success: true,
      message: '验证码已发送',
      // 注意：生产环境不应返回验证码，这里仅为了开发测试
      code: process.env.NODE_ENV === 'development' ? code : undefined
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码失败'
    });
  }
};

/**
 * 手机号验证码登录
 */
const loginWithPhoneCode = async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    // 验证手机号和验证码
    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: '手机号和验证码不能为空'
      });
    }
    
    // 验证码验证
    const savedCode = verificationCodes[phone];
    if (!savedCode || savedCode.code !== code) {
      return res.status(400).json({
        success: false,
        message: '验证码错误'
      });
    }
    
    // 验证码过期验证
    if (savedCode.expireAt < Date.now()) {
      delete verificationCodes[phone]; // 清理过期验证码
      return res.status(400).json({
        success: false,
        message: '验证码已过期'
      });
    }
    
    // 验证通过，清除验证码
    delete verificationCodes[phone];
    
    // 查询用户信息
    const authUsersCollection = db.collection('ai_user'); // 认证用户集合
    const { data: existingAuthUsers } = await authUsersCollection
      .where({
        phone: _.eq(phone)
      })
      .limit(1)
      .get();
    
    let authUser = existingAuthUsers[0];
    const now = new Date();
    
    let isNewUser = false;
    
    // 如果是新用户，创建认证用户记录
    if (!authUser) {
      // 生成一个临时ID作为用户ID
      const tempUserId = generateSnowflakeId();
      // 生成唯一的PetMeetID，并将用户ID关联到映射表中
      const PetMeetID = await generatePetMeetID(tempUserId);
      
      // 创建用户认证数据
      const authUserData = {
        phone,
        PetMeetID, // 添加PetMeetID字段
        nickName: `用户_${phone.slice(-4)}`,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        lastLoginAt: db.serverDate(),
        status: 'active',
        role: 'user'
      };
      
      // 将用户添加到 ai_user 表中
      const authResult = await authUsersCollection.add(authUserData);
      authUser = { _id: authResult.id, ...authUserData };
      
      // 创建用户资料记录
      const usersCollection = db.collection('user_profile');
      const profileData = {
        _openid: authUser._id, // 关联到认证用户的ID
        PetMeetID, // 添加PetMeetID到user_profile集合
        phone,
        nickName: `用户_${phone.slice(-4)}`,
        avatarUrl: '',
        gender: 0,
        city: '',
        province: '',
        country: '',
        language: 'zh_CN',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        stats: {
          followerCount: 0,
          followingCount: 0,
          favoritesCount: 0
        },
        profileCompleted: false
      };
      
      await usersCollection.add(profileData);
      isNewUser = true;
      console.log('新用户创建成功:', authUser);
    } else {
      // 检查并生成PetMeetID（如果不存在）
      const updateData = {
        updatedAt: db.serverDate(),
        lastLoginAt: db.serverDate()
      };
      
      if (!authUser.PetMeetID) {
        // 使用用户ID生成唯一的PetMeetID
        // 新的generatePetMeetID函数已经内置了唯一性检查，直接调用即可
        updateData.PetMeetID = await generatePetMeetID(authUser._id);
        console.log(`为用户 ${authUser._id} 生成PetMeetID: ${updateData.PetMeetID}`);
        
        // 同时更新user_profile
        const { data: profiles } = await db.collection('user_profile')
          .where({ _openid: _.eq(authUser._id) })
          .get();
          
        if (profiles && profiles.length > 0) {
          await db.collection('user_profile')
            .doc(profiles[0]._id)
            .update({ PetMeetID: updateData.PetMeetID });
        }
      }
      
      // 更新用户记录
      await authUsersCollection.doc(authUser._id).update(updateData);
      
      // 更新本地authUser对象
      authUser = { ...authUser, ...updateData };
      
      console.log('用户已存在:', authUser);
    }
    
    // 生成登录凭证 - 使用认证用户的ID
    const token = generateToken(authUser);
    
    // 获取用户资料信息（如果存在）
    const userProfileCollection = db.collection('user_profile');
    const { data: profileData } = await userProfileCollection
      .where({ _openid: _.eq(authUser._id) })
      .limit(1)
      .get();
    
    const userProfile = profileData && profileData.length > 0 ? profileData[0] : null;
    
    // 返回用户信息、token和新用户标识
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: authUser._id,
          phone: authUser.phone,
          PetMeetID: authUser.PetMeetID, // 添加PetMeetID到返回数据
          nickName: authUser.nickName,
          avatarUrl: userProfile ? userProfile.avatarUrl : '',
          profileCompleted: userProfile ? userProfile.profileCompleted : false
        },
        token,
        isNewUser // 添加新用户标识
      },
      message: isNewUser ? '新用户注册成功' : '登录成功'
    });
  } catch (error) {
    console.error('手机号登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  sendVerificationCode,
  loginWithPhoneCode
};
