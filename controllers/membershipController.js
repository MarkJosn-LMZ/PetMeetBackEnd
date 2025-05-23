const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

/**
 * 获取会员等级信息列表
 */
const getMembershipTiers = async (req, res) => {
  try {
    // 从数据库获取会员等级信息
    const levelCollection = db.collection('user_level');
    const { data: levels } = await levelCollection
      .orderBy('display_order', 'asc')
      .get();
    
    if (!levels || levels.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到会员等级信息'
      });
    }
    
    // 格式化返回数据
    const membershipTiers = levels.map(level => ({
      id: level.level_code,
      level: level.level_name,
      icon: level.icon,
      gradient: level.gradient,
      textColor: level.text_color,
      progressColor: level.progress_color,
      growthPointsRequired: level.upgrade_requirement || 0,
      priceMonthly: level.price_monthly || 0,
      priceAnnually: level.price_annually || 0,
      isRecommended: level.is_recommended || false,
      benefits: level.benefits || [],
      quotas: level.quotas || {}
    }));
    
    res.status(200).json({
      success: true,
      data: membershipTiers
    });
  } catch (error) {
    console.error('获取会员等级信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取会员等级信息失败',
      error: error.message
    });
  }
};

/**
 * 获取用户会员信息
 */
const getUserMembership = async (req, res) => {
  // 使用事务确保操作的原子性
  const transaction = await db.startTransaction();
  
  try {
    // 从认证中间件获取用户ID
    const userId = req.user?.userId;
    // 从认证中间件获取PetMeetID
    const PetMeetID = req.user?.PetMeetID;
    
    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: '用户未登录或 Token 无效'
      });
    }
    
    const userCollection = db.collection('user_membership');
    
    // 先尝试通过PetMeetID查询用户会员信息
    let memberships = [];
    
    // 如果有PetMeetID，先使用PetMeetID查询
    if (PetMeetID) {
      const PetMeetIDResult = await transaction
        .collection('user_membership')
        .where({ PetMeetID: PetMeetID })
        .get();
      
      if (PetMeetIDResult && PetMeetIDResult.data && PetMeetIDResult.data.length > 0) {
        memberships = PetMeetIDResult.data;
      }
    }
    
    // 如果使用PetMeetID没有找到，则使用userId查询
    if (memberships.length === 0) {
      const userIdResult = await transaction
        .collection('user_membership')
        .where({ userId: userId })
        .get();
      
      if (userIdResult && userIdResult.data) {
        memberships = userIdResult.data;
      }
    }
    
    // 如果已存在会员信息，直接返回
    if (memberships && memberships.length > 0) {
      // 获取会员等级信息，用于前端展示
      const userMembership = memberships[0];
      const levelCode = userMembership.membership_type || 'normal';
      
      // 获取会员等级详情
      const levelCollection = db.collection('user_level');
      const { data: levels } = await levelCollection
        .where({ level_code: levelCode })
        .get();
      
      const levelInfo = levels && levels.length > 0 ? levels[0] : null;
      
      // 添加会员权益说明（不存储到数据库，仅用于前端展示）
      const membershipWithBenefits = {
        ...userMembership,
        benefits: levelInfo?.benefits || [
          { text: '每月5次免费问答' },
          { text: '社区基本功能使用' },
          { text: '资源下载' }
        ]
      };
      
      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: membershipWithBenefits
      });
    }
    
    // 从数据库获取普通会员等级信息
    const levelCollection = db.collection('user_level');
    const { data: levels } = await levelCollection
      .where({ level_code: 'normal' })
      .get();
    
    if (!levels || levels.length === 0) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: '未找到默认会员等级信息'
      });
    }
    
    const normalLevel = levels[0];
    const now = new Date();
    
    // 获取用户的PetMeetID
    let userPetMeetID = PetMeetID;
    
    // 如果没有PetMeetID，尝试从用户表获取
    if (!userPetMeetID) {
      const userResult = await transaction
        .collection('ai_user')
        .doc(userId)
        .get();
      
      if (userResult && userResult.data && userResult.data.PetMeetID) {
        userPetMeetID = userResult.data.PetMeetID;
      }
    }
    
    // 创建默认会员信息，与数据库结构保持一致
    const defaultMembership = {
      user_id: userId,
      _openid: req.user?.openId || '', // 如果认证信息中包含 openid
      PetMeetID: userPetMeetID, // 添加PetMeetID字段
      auto_renew: false,
      benefit_usage: {
        download_count: 0,
        expert_consultation: {
          reset_date: now.getTime(),
          total: 0,
          used: 0
        },
        question_quota: {
          reset_date: now.getTime(),
          total: 5, // 普通会员每月5次问答
          used: 0
        }
      },
      created_at: now,
      expiration_date: null, // 普通会员可能没有过期时间，或设为很远的未来
      growth_points: 0,
      last_payment_date: now,
      membership_history: [],
      membership_type: 'normal',
      payment_plan: 'free', // 免费会员
      start_date: now,
      updated_at: now
    };
    
    // 添加会员权益说明（不存储到数据库，仅用于前端展示）
    const membershipWithBenefits = {
      ...defaultMembership,
      benefits: normalLevel.benefits || [
        { text: '每月5次免费问答' },
        { text: '社区基本功能使用' },
        { text: '资源下载' }
      ]
    };
    
    try {
      // 在事务中创建新的会员信息
      const result = await transaction.collection('user_membership').add(defaultMembership);
      
      // 提交事务
      await transaction.commit();
      
      // 返回新创建的会员信息（包含生成的_id）
      return res.status(200).json({
        success: true,
        data: {
          _id: result.id,
          ...membershipWithBenefits
        }
      });
    } catch (error) {
      // 如果是唯一键冲突错误（记录已存在），则重新获取
      if (error.code === 'DUPLICATE_KEY' || error.message.includes('duplicate')) {
        const { data: existing } = await db.collection('user_membership')
          .where({ user_id: userId })
          .get();
        
        if (existing && existing.length > 0) {
          return res.status(200).json({
            success: true,
            data: existing[0]
          });
        }
      }
      throw error; // 重新抛出其他错误
    }
  } catch (error) {
    console.error('获取用户会员信息失败:', error);
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: '获取用户会员信息失败',
      error: error.message
    });
  }
};

/**
 * 创建或更新用户会员信息
 */
const createOrUpdateMembership = async (req, res) => {
  try {
    // 从认证中间件获取用户ID
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未登录或 Token 无效'
      });
    }
    
    // 获取前端传递的会员数据
    const membershipData = req.body;
    
    // 添加用户ID到会员数据中
    membershipData.userId = userId;
    
    // 查询用户是否已有会员信息
    const userCollection = db.collection('user_membership');
    const { data: existingMemberships } = await userCollection.where({
      userId: userId
    }).get();
    
    let result;
    
    // 如果已有会员信息，则更新
    if (existingMemberships && existingMemberships.length > 0) {
      const membershipId = existingMemberships[0]._id;
      // 更新会员信息
      await userCollection.doc(membershipId).update({
        ...membershipData,
        updatedAt: new Date()
      });
      
      // 获取更新后的数据
      const { data } = await userCollection.doc(membershipId).get();
      result = data[0];
    } else {
      // 如果没有会员信息，则创建新的
      membershipData.createdAt = new Date();
      membershipData.updatedAt = new Date();
      
      // 创建会员信息
      const { id } = await userCollection.add(membershipData);
      
      // 获取创建的数据
      const { data } = await userCollection.doc(id).get();
      result = data[0];
    }
    
    res.status(200).json({
      success: true,
      message: '会员信息已更新',
      data: result
    });
  } catch (error) {
    console.error('创建或更新会员信息失败:', error);
    res.status(500).json({
      success: false,
      message: '创建或更新会员信息失败',
      error: error.message
    });
  }
};

/**
 * 会员购买处理
 */
const purchaseMembership = async (req, res) => {
  try {
    // 从认证中间件获取用户ID
    const userId = req.user?.userId;
    // 从认证中间件获取PetMeetID
    const PetMeetID = req.user?.PetMeetID;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未登录或 Token 无效'
      });
    }
    
    // 确保我们有用户的PetMeetID
    let userPetMeetID = PetMeetID;
    if (!userPetMeetID) {
      // 如果没有PetMeetID，从用户表中获取
      const userCollection = db.collection('ai_user');
      const { data: userData } = await userCollection.doc(userId).get();
      
      if (userData && userData.PetMeetID) {
        userPetMeetID = userData.PetMeetID;
      } else {
        console.warn(`用户 ${userId} 没有PetMeetID`);
      }
    }
    
    // 获取前端传递的支付数据
    const { tierId, plan, amount } = req.body;
    
    // 确保必要参数存在
    if (!tierId || !plan || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的支付参数'
      });
    }
    
    // 生成订单号
    const orderId = 'ORDER_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // 计算有效期
    const startDate = new Date();
    let expirationDate = new Date();
    
    if (plan === 'monthly') {
      // 月付，有效期增加1个月
      expirationDate.setMonth(expirationDate.getMonth() + 1);
    } else {
      // 年付，有效期增加1年
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    }
    
    // 保存订单信息到数据库
    const orderCollection = db.collection('payment_orders');
    await orderCollection.add({
      orderId,
      userId,
      PetMeetID: userPetMeetID, // 添加PetMeetID字段
      tierId,
      plan,
      amount,
      status: 'pending', // 支付状态: pending/success/failed
      createdAt: new Date()
    });
    
    // 基于会员等级更新权益
    const benefitUsage = {
      questionQuota: {
        used: 0,
        total: tierId === 'bronze' ? 20 : 
               tierId === 'silver' ? 50 :
               tierId === 'gold' ? 100 : 
               tierId === 'platinum' ? 999 : 5,
        resetDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
      },
      expertConsultation: {
        used: 0,
        total: tierId === 'bronze' ? 1 : 
               tierId === 'silver' ? 3 :
               tierId === 'gold' ? 5 : 
               tierId === 'platinum' ? 10 : 0,
        resetDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
      },
      downloadCount: 0
    };
    
    // 查询用户现有的会员信息
    const userMembershipCollection = db.collection('user_membership');
    
    // 先尝试使用PetMeetID查询
    let memberships = [];
    if (userPetMeetID) {
      const PetMeetIDResult = await userMembershipCollection
        .where({ PetMeetID: userPetMeetID })
        .get();
        
      if (PetMeetIDResult.data && PetMeetIDResult.data.length > 0) {
        memberships = PetMeetIDResult.data;
      }
    }
    
    // 如果没有找到，则使用userId查询
    if (memberships.length === 0) {
      const userIdResult = await userMembershipCollection
        .where({ userId: userId })
        .get();
      
      if (userIdResult.data) {
        memberships = userIdResult.data;
      }
    }
    
    if (memberships && memberships.length > 0) {
      // 如果已有会员，更新会员信息
      const membershipId = memberships[0]._id;
      // 更新现有会员信息
      const updateData = {
        levelId: tierId,
        payment_plan: plan,
        start_date: startDate.toISOString().split('T')[0],
        expiration_date: expirationDate.toISOString().split('T')[0],
        updated_at: new Date(),
        benefit_usage: benefitUsage,
        last_payment_date: new Date(),
        auto_renew: false
      };
      
      // 添加会员历史记录
      if (memberships[0].levelId !== tierId) {
        updateData.membership_history = [
          ...(memberships[0].membership_history || []),
          {
            from_level: memberships[0].levelId,
            to_level: tierId,
            change_date: new Date(),
            payment_plan: plan,
            amount_paid: amount
          }
        ];
      }
      
      await userCollection.doc(membershipId).update(updateData);
    } else {
      // 如果没有会员信息，创建新的
      await userCollection.add({
        user_id: userId,
        _openid: req.user?.openId || '',
        levelId: tierId,
        growth_points: 0,
        payment_plan: plan,
        start_date: startDate.toISOString().split('T')[0],
        expiration_date: expirationDate.toISOString().split('T')[0],
        created_at: new Date(),
        updated_at: new Date(),
        benefit_usage: benefitUsage,
        membership_type: tierId,
        auto_renew: false,
        last_payment_date: new Date(),
        membership_history: []
      });
    }
    
    // 更新订单状态为成功
    await orderCollection.where({ orderId }).update({
      status: 'success',
      paidAt: new Date()
    });
    
    // 返回支付参数给前端
    // 注意：这里只是模拟，实际应用中需要对接真实支付接口
    const mockPayParams = {
      timeStamp: '' + Math.floor(Date.now() / 1000),
      nonceStr: Math.random().toString(36).substring(2, 15),
      package: 'prepay_id=wx' + Date.now(),
      signType: 'MD5',
      paySign: 'mock_sign_' + Math.random().toString(36).substring(2, 15)
    };
    
    res.status(200).json({
      success: true,
      message: '会员升级成功',
      data: mockPayParams,
      orderId
    });
    
    // 实际支付逻辑应该在这里调用微信支付接口
    // 支付成功后不需要额外处理，因为我们已经更新了会员信息
    console.log(`用户 ${userId} 会员等级已更新为 ${tierId}`);
    
  } catch (error) {
    console.error('处理会员购买失败:', error);
    res.status(500).json({
      success: false,
      message: '处理会员购买失败',
      error: error.message
    });
  }
};

module.exports = {
  getMembershipTiers,
  getUserMembership,
  createOrUpdateMembership,
  purchaseMembership
};
