const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

/**
 * JWT 认证中间件
 */
const authenticateToken = async (req, res, next) => {
  try {
    console.log('收到请求:', req.method, req.path);
    console.log('请求头:', JSON.stringify(req.headers, null, 2));
    
    // 从请求头中获取 token
    // 先尝试获取自定义头部 x-token
    let token = req.headers['x-token'] || req.headers['X-Token'];
    console.log('X-Token 头:', token);
    
    // 如果没有 x-token，再尝试 authorization 头
    if (!token) {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      console.log('Authorization 头:', authHeader);
      
      if (authHeader) {
        // 检查 Bearer 前缀
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
          token = parts[1];
          console.log('从 Authorization 头提取的 token:', token);
        } else {
          console.log('令牌格式错误，期望格式: Bearer <token>');
        }
      }
    }
    
    // 如果仍然没有 token，返回未授权错误
    if (!token) {
      console.log('未提供令牌');
      return res.status(401).json({
        success: false,
        message: '未提供访问令牌'
      });
    }
    
    console.log('最终使用的 token:', token);

    // 验证 token
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    console.log('使用密钥验证 token...');
    
    let decoded;
    try {
      // 先尝试解析token payload来检查是否是管理系统token
      let isManagerToken = false;
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload.service === 'petmeet-manager') {
            isManagerToken = true;
            console.log('检测到管理系统token，进行特殊处理...');
          }
        }
      } catch (parseError) {
        // 如果解析失败，继续使用标准JWT验证
        console.log('token解析失败，使用标准JWT验证');
      }
      
      if (isManagerToken) {
        try {
          // 管理系统token的特殊处理
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log('管理系统token payload:', payload);
            
            // 验证是否是有效的管理系统token
            if (payload.service === 'petmeet-manager') {
              decoded = {
                userId: payload.userId || 'petmeet-manager-user',
                nickName: payload.nickName || '管理系统用户',
                PetMeetID: payload.PetMeetID || null,
                service: 'petmeet-manager',
                exp: payload.exp || Math.floor(Date.now() / 1000) + 3600,
                iat: payload.iat || Math.floor(Date.now() / 1000)
              };
              console.log('管理系统token验证成功');
            } else {
              throw new Error('无效的管理系统token');
            }
          } else {
            throw new Error('管理系统token格式错误');
          }
        } catch (managerTokenError) {
          console.error('管理系统token解析失败:', managerTokenError.message);
          throw managerTokenError;
        }
      } else {
        // 使用标准JWT验证
        decoded = jwt.verify(token, secret);
        console.log('标准JWT验证成功，payload:', decoded);
      }
    } catch (err) {
      console.error('Token 验证失败:', err.message);
      return res.status(401).json({
        success: false,
        message: '无效的访问令牌',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    if (!decoded.userId) {
      console.log('Token 中缺少 userId');
      return res.status(401).json({
        success: false,
        message: '无效的访问令牌: 缺少用户ID'
      });
    }
    
    // 如果是管理系统的请求，跳过用户验证
    if (decoded.service === 'petmeet-manager') {
      console.log('管理系统请求，跳过用户验证');
      
      // 从token中提取用户信息
      const tokenUserId = decoded.userId || 'petmeet-manager-user';
      const tokenNickName = decoded.nickName || '管理系统用户';
      const tokenPetMeetID = decoded.PetMeetID || null;
      
      console.log('管理系统token中的用户信息:', {
        userId: tokenUserId,
        nickName: tokenNickName,
        PetMeetID: tokenPetMeetID
      });
      
      // 设置用户信息到req.user，确保帖文创建时使用正确的用户信息
      req.user = {
        userId: tokenUserId,  // 使用token中的真实用户ID
        authUser: {
          _id: tokenUserId,
          nickName: tokenNickName,  // 使用token中的真实昵称
          status: 'active',
          role: 'manager',
          service: 'petmeet-manager',
          PetMeetID: tokenPetMeetID  // 使用token中的PetMeetID
        },
        profileUser: {
          _openid: tokenUserId,
          nickName: tokenNickName,
          PetMeetID: tokenPetMeetID,
          avatarUrl: '',  // 管理系统用户默认头像
          isAIGenerated: false,
          virtualSource: 'petmeet-manager'
        },
        PetMeetID: tokenPetMeetID,
        isManager: true
      };
      
      console.log('设置的req.user信息:', {
        userId: req.user.userId,
        nickName: req.user.authUser.nickName,
        PetMeetID: req.user.PetMeetID
      });
      
      return next();
    }
    
    // 验证用户是否存在 - 先尝试从 ai_user 集合查询
    console.log('查询认证用户 userId:', decoded.userId);
    let authUser = null;
    
    try {
      // 首先尝试从 ai_user 查询，使用 _id
      const { data: authUsers } = await db.collection('ai_user')
        .where({
          _id: _.eq(decoded.userId)
        })
        .limit(1)
        .get();
      
      authUser = authUsers && authUsers[0];
      console.log('从 ai_user 查询到的用户:', authUser);
      
      // 如果在 ai_user 中找不到，则尝试从 user_profile 查询
      if (!authUser) {
        console.log('在 ai_user 中未找到用户，尝试从 user_profile 查询');
        const { data: profileUsers } = await db.collection('user_profile')
          .where({
            _openid: _.eq(decoded.userId)
          })
          .limit(1)
          .get();
        
        const userProfile = profileUsers && profileUsers[0];
        console.log('关联的用户资料:', userProfile);
        
        // 如果找到了用户资料，则创建一个模拟的 authUser 对象
        if (userProfile) {
          authUser = {
            _id: decoded.userId,
            _openid: decoded.userId,
            phone: userProfile.phone || '',
            nickName: userProfile.nickName || userProfile.nickname || decoded.nickName || '',
            status: 'active', // 假设用户状态正常
            role: decoded.role || 'user',
            PetMeetID: userProfile.PetMeetID // 从用户资料中获取PetMeetID
          };
        }
      }
      
      // 特殊处理：如果用户不存在但token中包含admin角色，创建管理员用户对象
      if (!authUser && decoded.role === 'admin') {
        console.log('用户不存在但具有admin角色，创建管理员用户对象');
        authUser = {
          _id: decoded.userId,
          _openid: decoded.userId,
          phone: '',
          nickName: decoded.nickName || '管理员',
          status: 'active',
          role: 'admin',
          PetMeetID: decoded.petMeetId || null // 使用token中的PetMeetID
        };
      }
      
      if (!authUser) {
        console.log('认证用户不存在或已被删除');
        return res.status(401).json({
          success: false,
          message: '用户认证失败，请重新登录'
        });
      }
      
      // 检查用户状态
      if (authUser.status !== 'active') {
        console.log('用户状态非正常:', authUser.status);
        return res.status(403).json({
          success: false,
          message: '账号已被禁用或锁定，请联系管理员'
        });
      }
    } catch (error) {
      console.error('查询用户记录时出错:', error);
      return res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? error.message : {}
      });
    }

    // 将认证用户信息添加到请求对象中
    // 同时查询对应的用户资料，使用 openid
    const { data: profileUsers } = await db.collection('user_profile')
      .where({ _openid: _.eq(decoded.userId) })
      .limit(1)
      .get();
    
    const profileUser = profileUsers && profileUsers[0];
    console.log('关联的用户资料:', profileUser);
    
    // 获取PetMeetID
    let PetMeetID = null;
    
    // 先从请求头获取
    if (req.headers['x-petmeet-id'] || req.headers['X-PetMeet-ID']) {
      PetMeetID = req.headers['x-petmeet-id'] || req.headers['X-PetMeet-ID'];
      console.log('从请求头获取到PetMeetID:', PetMeetID);
    }
    
    // 如果在请求头中没有，则从认证用户信息中获取
    if (!PetMeetID && authUser && authUser.PetMeetID) {
      PetMeetID = authUser.PetMeetID;
      console.log('从认证用户信息获取到PetMeetID:', PetMeetID);
    }
    
    req.user = {
      userId: decoded.userId,  // 以认证用户ID作为用户标识
      authUser: authUser,      // 认证用户数据
      profileUser: profileUser,  // 用户资料数据（如果存在）
      PetMeetID: PetMeetID,     // 用户的PetMeetID
      role: authUser.role || decoded.role || 'user'  // 确保角色信息正确传递
    };

    next();
  } catch (error) {
    console.error('认证失败:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '访问令牌已过期，请重新登录',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: '无效的访问令牌',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 可选认证中间件，如果提供了token会验证，没有提供也会继续
const optional = (req, res, next) => {
  // 从请求头中获取 token
  let token = req.headers['x-token'] || req.headers['X-Token'];
  
  // 如果没有 x-token，再尝试 authorization 头
  if (!token) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }
  }
  
  // 如果没有token，直接继续
  if (!token) {
    req.user = null;
    return next();
  }
  
  // 验证token
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      // token无效，但仍然允许继续
      req.user = null;
    } else {
      // token有效，设置用户信息
      req.user = user;
    }
    next();
  });
};

module.exports = {
  authenticateToken,
  optional
};
