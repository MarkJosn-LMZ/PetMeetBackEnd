const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

// 用户资料 CRUD

/**
 * 创建或更新用户资料
 */
const saveUserProfile = async (req, res) => {
  try {
    const { userId, PetMeetID } = req.user;
    const userData = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      });
    }

    const userProfileCollection = db.collection('user_profile');
    const now = db.serverDate();
    
    // 检查用户是否已存在
    // 优先使用PetMeetID查询，只有在没有结果时才使用openid
    let existingUser = [];
    
    if (PetMeetID) {
      const { data: userByPetMeetID } = await userProfileCollection
        .where({ PetMeetID: _.eq(PetMeetID) })
        .get();
      
      if (userByPetMeetID && userByPetMeetID.length > 0) {
        existingUser = userByPetMeetID;
      }
    }
    
    // 如果没有通过PetMeetID找到用户，则使用openid查询
    if (existingUser.length === 0) {
      const { data: userByOpenID } = await userProfileCollection
        .where({ _openid: _.eq(userId) })
        .get();
      
      if (userByOpenID && userByOpenID.length > 0) {
        existingUser = userByOpenID;
      }
    }

    const userProfile = {
      ...userData,
      PetMeetID: PetMeetID, // 添加PetMeetID字段
      updatedAt: now,
      profileCompleted: true
    };

    let result;
    if (existingUser && existingUser.length > 0) {
      // 更新现有用户
      result = await userProfileCollection
        .doc(existingUser[0]._id)
        .update(userProfile);
    } else {
      // 创建新用户
      userProfile.createdAt = now;
      userProfile._openid = userId;
      result = await userProfileCollection.add(userProfile);
    }

    res.status(200).json({
      success: true,
      data: result,
      message: '用户资料保存成功'
    });
  } catch (error) {
    console.error('保存用户资料失败:', error);
    res.status(500).json({
      success: false,
      message: '保存用户资料失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取用户资料
 */
const getUserProfile = async (req, res) => {
  try {
    // 从 req.user 中获取用户认证信息和资料信息
    const { userId, authUser, profileUser } = req.user;
    console.log('获取用户资料，用户ID:', userId);

    // 如果认证中间件已经获取到用户资料，直接返回
    if (profileUser) {
      console.log('使用认证中间件获取的用户资料:', profileUser);
      return res.status(200).json({
        success: true,
        data: profileUser
      });
    }
    
    // 如果没有获取到资料，从数据库中使用 _openid 查询
    const { data } = await db.collection('user_profile')
      .where({ _openid: _.eq(userId) })
      .get();

    console.log('使用 _openid 查询结果:', data);

    if (!data || data.length === 0) {
      // 如果用户资料不存在，但认证用户存在，创建一个新的用户资料
      if (authUser) {
        const newUserProfile = {
          _openid: userId,
          phone: authUser.phone,
          nickName: authUser.nickName,
          avatarUrl: '',
          gender: 0,
          bio: '',
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
        
        // 添加新的用户资料
        const result = await db.collection('user_profile').add(newUserProfile);
        console.log('创建新的用户资料:', { _id: result.id, ...newUserProfile });
        
        return res.status(200).json({
          success: true,
          data: { _id: result.id, ...newUserProfile },
          message: '新用户资料创建成功'
        });
      }
      
      console.log('用户资料不存在');
      return res.status(404).json({
        success: false,
        message: '用户资料不存在'
      });
    }

    console.log('成功获取用户资料:', data[0]);
    res.status(200).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    console.error('获取用户资料失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户资料失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除用户资料
 */
const deleteUserProfile = async (req, res) => {
  try {
    const { userId } = req.user;

    const { data } = await db.collection('user_profile')
      .where({ _openid: _.eq(userId) })
      .get();

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户资料不存在'
      });
    }

    await db.collection('user_profile').doc(data[0]._id).remove();

    res.status(200).json({
      success: true,
      message: '用户资料删除成功'
    });
  } catch (error) {
    console.error('删除用户资料失败:', error);
    res.status(500).json({
      success: false,
      message: '删除用户资料失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 关注功能

/**
 * 切换关注状态
 * 可以关注或取消关注某个用户
 */
const toggleFollow = async (req, res) => {
  try {
    // 错误码定义
    const ErrorCode = {
      PARAM_INVALID: 9001,
      CANNOT_FOLLOW_SELF: 9002,
      TARGET_USER_NOT_FOUND: 9003,
      DATABASE_ERROR: 9004,
      TRANSACTION_ERROR: 9005,
      UNAUTHORIZED: 9006
    };

    // 1. 获取当前用户ID
    const followerOpenid = req.user?.userId;
    if (!followerOpenid) {
      return res.status(401).json({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        message: '无法获取用户信息，请检查登录状态'
      });
    }

    // 2. 获取并校验目标用户ID
    const { followingOpenid } = req.body;
    if (!followingOpenid || typeof followingOpenid !== 'string') {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '参数无效 (followingOpenid)'
      });
    }

    // 3. 不能关注自己
    if (followerOpenid === followingOpenid) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.CANNOT_FOLLOW_SELF,
        message: '不能关注自己'
      });
    }

    console.log(`用户 ${followerOpenid} 尝试切换对用户 ${followingOpenid} 的关注状态`);
    
    // 获取关注者和被关注者的PetMeetID
    let followerPetMeetID = null;
    let followingPetMeetID = null;
    
    // 从用户信息获取PetMeetID
    try {
      // 获取关注者的PetMeetID
      const followerRes = await db.collection('ai_user').doc(followerOpenid).get();
      if (followerRes.data && followerRes.data.PetMeetID) {
        followerPetMeetID = followerRes.data.PetMeetID;
        console.log(`关注者PetMeetID: ${followerPetMeetID}`);
      }
      
      // 获取被关注者的PetMeetID
      const followingRes = await db.collection('ai_user').doc(followingOpenid).get();
      if (followingRes.data && followingRes.data.PetMeetID) {
        followingPetMeetID = followingRes.data.PetMeetID;
        console.log(`被关注者PetMeetID: ${followingPetMeetID}`);
      }
    } catch (err) {
      console.error('获取PetMeetID时出错:', err);
      // 如果获取PetMeetID出错，继续使用openid处理
    }

    // 4. 开始事务
    const transaction = await db.startTransaction();
    let isFollowing = false;
    let followCountChange = 0;

    try {
      // 5. 检查目标用户是否存在
      const targetUserRes = await transaction.collection('user_profile').where({
        _openid: followingOpenid
      }).limit(1).field({ _id: true }).get();

      if (!targetUserRes.data || targetUserRes.data.length === 0) {
        await transaction.rollback(-100);
        console.log(`目标用户 ${followingOpenid} 不存在`);
        return res.status(404).json({
          success: false,
          code: ErrorCode.TARGET_USER_NOT_FOUND,
          message: '关注的目标用户不存在'
        });
      }

      // 6. 检查当前关注关系
      const followCollection = db.collection('ai_follow');
      
      // 构建查询条件，优先使用PetMeetID
      let followQuery = {};
      
      if (followerPetMeetID && followingPetMeetID) {
        // 如果有PetMeetID，优先使用
        followQuery = {
          followerPetMeetID: followerPetMeetID,
          followingPetMeetID: followingPetMeetID
        };
      } else {
        // 如果没有PetMeetID，使用openid
        followQuery = {
          followerOpenid: followerOpenid,
          followingOpenid: followingOpenid
        };
      }
      
      const { data: existingFollows } = await followCollection
        .where(followQuery)
        .get();

      if (existingFollows.length > 0) {
        // 已关注，执行取消关注
        console.log(`用户 ${followerOpenid} 已关注 ${followingOpenid}，执行取消关注`);
        const followIdToDelete = existingFollows[0]._id;
        
        // 在事务中删除记录
        try {
          await transaction.collection('ai_follow').doc(followIdToDelete).remove();
          console.log(`已成功删除关注记录 ID: ${followIdToDelete}`);
        } catch (removeError) {
          console.error(`删除关注记录失败:`, removeError);
          throw new Error(`Failed to remove follow record: ${removeError.message}`);
        }
        followCountChange = -1;
        isFollowing = false;
      } else {
        // 未关注，执行关注
        console.log(`用户 ${followerOpenid} 未关注 ${followingOpenid}，执行关注`);
        // 注意：事务中的add方法的参数结构与普通的add不同
        // 创建关注记录
        const followData = {
          followerOpenid: followerOpenid,
          followingOpenid: followingOpenid,
          followerPetMeetID: followerPetMeetID, // 添加关注者PetMeetID
          followingPetMeetID: followingPetMeetID, // 添加被关注者PetMeetID
          createdAt: db.serverDate()
        };
        await transaction.collection('ai_follow').add(followData);
        followCountChange = 1;
        isFollowing = true;
      }

      // 7. 原子更新双方计数
      if (followCountChange !== 0) {
        const updateFollowerPromise = transaction.collection('user_profile').where({
          _openid: followerOpenid
        }).update({
          data: {
            'stats.followingCount': _.inc(followCountChange),
            updatedAt: db.serverDate()
          }
        });
        const updateFollowingPromise = transaction.collection('user_profile').where({
          _openid: followingOpenid
        }).update({
          data: {
            'stats.followerCount': _.inc(followCountChange),
            updatedAt: db.serverDate()
          }
        });
        await Promise.all([updateFollowerPromise, updateFollowingPromise]);
        console.log(`用户 ${followerOpenid} 的 followingCount 和用户 ${followingOpenid} 的 followerCount 变化: ${followCountChange}`);
      }

      // 8. 提交事务
      await transaction.commit();
      console.log('关注状态更新事务提交成功');

      // 9. 返回结果
      return res.status(200).json({
        success: true,
        data: {
          isFollowing: isFollowing
        },
        message: isFollowing ? '关注成功' : '取消关注成功'
      });

    } catch (e) {
      // 处理事务错误
      await transaction.rollback();
      console.error('toggleFollow 事务执行失败，已回滚:', e);
      return res.status(500).json({
        success: false,
        code: ErrorCode.TRANSACTION_ERROR,
        message: '操作失败，请稍后重试'
      });
    }
  } catch (error) {
    console.error('处理关注请求时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * 检查关注状态
 * 用于获取当前用户是否关注了目标用户
 */
const checkFollowStatus = async (req, res) => {
  try {
    // 1. 获取当前用户ID
    const followerOpenid = req.user?.userId;
    if (!followerOpenid) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }

    // 2. 获取目标用户ID
    const { targetUserId } = req.params;
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: '缺少目标用户ID'
      });
    }

    // 3. 查询关注记录
    const { data } = await db.collection('ai_follow').where({
      followerOpenid: followerOpenid,
      followingOpenid: targetUserId
    }).limit(1).get();

    // 4. 返回关注状态
    return res.status(200).json({
      success: true,
      data: {
        isFollowing: data && data.length > 0
      }
    });

  } catch (error) {
    console.error('检查关注状态时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 宠物资料 CRUD

/**
 * 创建或更新宠物资料
 */
const savePetProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const petData = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      });
    }

    const petsCollection = db.collection('ai_pet');
    const now = db.serverDate();
    
    const petProfile = {
      ...petData,
      ownerId: userId,
      updatedAt: now
    };

    // 检查宠物是否已存在
    const query = petData._id 
      ? { _id: _.eq(petData._id), ownerId: _.eq(userId) }
      : { ownerId: _.eq(userId) };

    const { data: existingPets } = await petsCollection
      .where(query)
      .get();

    let result;
    if (existingPets && existingPets.length > 0) {
      // 更新现有宠物
      result = await petsCollection
        .doc(existingPets[0]._id)
        .update(petProfile);
    } else {
      // 创建新宠物
      petProfile.createdAt = now;
      result = await petsCollection.add(petProfile);
    }

    res.status(200).json({
      success: true,
      data: result,
      message: '宠物资料保存成功'
    });
  } catch (error) {
    console.error('保存宠物资料失败:', error);
    res.status(500).json({
      success: false,
      message: '保存宠物资料失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取用户的所有宠物资料
 */
const getPetProfiles = async (req, res) => {
  try {
    const { userId } = req.user;
    console.log('获取用户宠物资料，用户ID:', userId);

    const result = await db.collection('ai_pet')
      .where({ ownerId: _.eq(userId) })
      .get();
    
    const data = result.data || [];
    console.log(`找到 ${data.length} 条宠物记录`);

    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('获取宠物资料列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取宠物资料列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 获取单个宠物资料
 */
const getPetProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { pet_id } = req.params;

    const { data } = await db.collection('ai_pet')
      .where({ _id: _.eq(pet_id), ownerId: _.eq(userId) })
      .get();

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '宠物资料不存在'
      });
    }

    res.status(200).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    console.error('获取宠物资料失败:', error);
    res.status(500).json({
      success: false,
      message: '获取宠物资料失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 删除宠物资料
 */
const deletePetProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { pet_id } = req.params;

    const { data } = await db.collection('ai_pet')
      .where({ _id: _.eq(pet_id), ownerId: _.eq(userId) })
      .get();

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: '宠物资料不存在'
      });
    }

    await db.collection('ai_pet').doc(pet_id).remove();

    res.status(200).json({
      success: true,
      message: '宠物资料删除成功'
    });
  } catch (error) {
    console.error('删除宠物资料失败:', error);
    res.status(500).json({
      success: false,
      message: '删除宠物资料失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  // 用户资料
  saveUserProfile,
  getUserProfile,
  deleteUserProfile,
  
  // 关注功能
  toggleFollow,
  checkFollowStatus,
  
  // 宠物资料
  savePetProfile,
  getPetProfiles,
  getPetProfile,
  deletePetProfile,
  
  // 兼容旧版
  saveProfile: saveUserProfile,
  getProfile: getUserProfile
};
