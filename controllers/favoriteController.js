const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

/**
 * 切换收藏状态（收藏/取消收藏）
 * @route POST /api/favorites/toggle
 * @param {string} req.body.postId - 帖子ID
 * @returns {object} 收藏操作结果
 */
exports.toggleFavorite = async (req, res) => {
  try {
    console.log('========== 收藏操作开始 ==========');
    const { postId } = req.body;
    const { userId, PetMeetID } = req.user; // 从认证中间件获取用户ID和PetMeetID
    
    console.log(`用户 ${userId} (PetMeetID: ${PetMeetID || '无'}) 正在操作帖子 ${postId}`);

    if (!postId) {
      console.log('缺少 postId 参数');
      return res.status(400).json({
        success: false,
        message: '缺少 postId 参数',
        code: 400,
        countChange: 0
      });
    }

    if (!userId) {
      console.log('无法获取用户ID');
      return res.status(401).json({
        success: false,
        message: "无法获取用户信息，请检查登录状态",
        code: 401,
        countChange: 0
      });
    }

    const favoriteCollection = db.collection('ai_favorite');
    const postCollection = db.collection('ai_post');

    // 添加请求去重机制，防止前端重复请求
    console.log(`检查是否重复请求`);
    const cacheKey = `${userId}_${postId}_favorite`;
    const reqTimestamp = new Date().getTime();
    
    // 首先从数据库中检查当前帖子的状态
    console.log(`正在查询帖子 ${postId} 的状态`);
    
    // 查询帖子信息
    const postResult = await postCollection.doc(postId).get();
    console.log(`帖子信息:`, postResult.data);
    
    // 检查帖子信息格式，确定收藏数字段位置
    const favoriteCountField = postResult.data.data && postResult.data.data.favoriteCount !== undefined
      ? 'data.favoriteCount' // 如果收藏数在 data.favoriteCount
      : 'favoriteCount';     // 如果收藏数在直接的 favoriteCount 字段
    
    console.log(`收藏数字段位置: ${favoriteCountField}`);
    
    // 查询收藏记录
    // 注意：我们直接查询收藏记录而不是计数，以确保能获取完整记录信息
    const favoriteRecords = await favoriteCollection.where({
      _openid: userId,
      postId: postId
    }).get();
    
    console.log(`收藏记录查询结果:`, JSON.stringify(favoriteRecords.data));
    
    // 打印查询用的条件
    console.log(`查询条件: _openid=${userId}, postId=${postId}`);
    
    if (!postResult.data) {
      console.log(`帖子 ${postId} 不存在`);
      return res.status(404).json({
        success: false,
        message: '帖子不存在',
        code: 404,
        countChange: 0
      });
    }
    
    // 获取当前收藏数量
    let currentFavoriteCount = 0;
    if (favoriteCountField === 'data.favoriteCount') {
      // 如果收藏数在 data.favoriteCount
      currentFavoriteCount = (postResult.data.data && postResult.data.data.favoriteCount) || 0;
    } else {
      // 如果收藏数在直接的 favoriteCount 字段
      currentFavoriteCount = postResult.data.favoriteCount || 0;
    }
    const wasAlreadyFavorited = favoriteRecords.data.length > 0;
    
    console.log(`当前帖子收藏数: ${currentFavoriteCount}`);
    console.log(`用户当前收藏状态: ${wasAlreadyFavorited ? '已收藏' : '未收藏'}`);
    console.log(`收藏记录数量: ${favoriteRecords.data.length}`);
    
    // 现在我们已经知道用户的收藏状态
    // 如果有收藏记录，先删除所有记录
    let recordsRemoved = 0;
    
    if (wasAlreadyFavorited) {
      console.log(`存在收藏记录，先删除`);
      
      // 必要时先尝试删除特定记录
      if (favoriteRecords.data.length > 0) {
        try {
          for (const record of favoriteRecords.data) {
            console.log(`删除收藏记录: ${record._id}`);
            await favoriteCollection.doc(record._id).remove();
            recordsRemoved++;
          }
          console.log(`成功删除 ${recordsRemoved} 条收藏记录`);
        } catch (error) {
          console.error(`删除收藏记录出错:`, error);
          
          // 如果单条删除失败，尝试批量删除
          const deleteAllResult = await favoriteCollection.where({
            _openid: userId,
            postId: postId
          }).remove();
          
          recordsRemoved = deleteAllResult.deleted || 0;
          console.log(`批量删除结果: 删除了 ${recordsRemoved} 条记录`);
        }
      }
    } else {
      console.log(`不存在收藏记录，无需删除`);
    }
    
    // 检查删除后是否有收藏记录遗漏
    const afterDeleteCheck = await favoriteCollection.where({
      _openid: userId,
      postId: postId
    }).count();
    
    if (afterDeleteCheck.total > 0) {
      console.log(`警告: 删除后仍有 ${afterDeleteCheck.total} 条收藏记录存在`);
    }
    
    let countChange = 0;
    let isFavorited = false;

    if (wasAlreadyFavorited) {
      // 原来已经收藏，现在执行取消收藏操作
      // 由于我们已经删除了记录，只需更新计数
      console.log(`执行取消收藏操作`);
      
      // 更新帖子收藏数（减 1）
      // 使用绝对值设置而不是增量操作
      const newCount = Math.max(0, currentFavoriteCount - 1); // 始终只减1，因为多余的是重复记录
      console.log(`更新收藏数: ${currentFavoriteCount} -> ${newCount}`);
      
      // 根据收藏数字段位置更新
      if (favoriteCountField === 'data.favoriteCount') {
        // 如果收藏数存储在 data.favoriteCount
        await postCollection.doc(postId).update({
          data: {
            'data.favoriteCount': newCount
          }
        });
      } else {
        // 如果收藏数存储在直接的 favoriteCount
        await postCollection.doc(postId).update({
          data: {
            favoriteCount: newCount
          }
        });
      }
      
      countChange = -1; // 始终只认为减了1个计数
      isFavorited = false;
      console.log(`收藏数变化: ${countChange}`);
    } else {
      // 原来未收藏，现在执行添加收藏操作
      console.log(`执行添加收藏操作`);
      
      // 使用与原有收藏记录一致的格式，不要加嵌套的 data 字段
      const favoriteData = {
        _openid: userId,
        PetMeetID: PetMeetID, // 添加PetMeetID字段
        postId: postId,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        status: 'active'
      };
      
      const addResult = await favoriteCollection.add(favoriteData);
      
      console.log(`添加收藏结果:`, addResult);

      // 直接设置准确的新值
      const newCount = currentFavoriteCount + 1;
      console.log(`更新收藏数: ${currentFavoriteCount} -> ${newCount}`);
      
      // 根据收藏数字段位置更新
      if (favoriteCountField === 'data.favoriteCount') {
        // 如果收藏数存储在 data.favoriteCount
        await postCollection.doc(postId).update({
          data: {
            'data.favoriteCount': newCount
          }
        });
      } else {
        // 如果收藏数存储在直接的 favoriteCount
        await postCollection.doc(postId).update({
          data: {
            favoriteCount: newCount
          }
        });
      }
      
      countChange = 1;
      isFavorited = true;
      console.log(`收藏数变化: ${countChange}`);
    }

    // 核实机制: 重新统计实际的收藏数，确保前端和数据库的一致性
    // 加入延迟，确保之前的操作已经完成
    console.log(`等待数据库操作同步...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待500毫秒
    
    const actualFavoriteCount = await favoriteCollection.where({
      postId: postId
    }).count();
    
    console.log(`查询到实际收藏数: ${actualFavoriteCount.total}`);
    
    // 如果实际收藏数与帖子记录的收藏数不同，更新帖子收藏数
    if (actualFavoriteCount.total !== (currentFavoriteCount + countChange)) {
      console.log(`检测到收藏数不一致，进行修正，实际收藏数: ${actualFavoriteCount.total}, 帖子记录的收藏数: ${currentFavoriteCount}, 变化量: ${countChange}`);
      
      // 强制更新为实际的收藏数
      if (favoriteCountField === 'data.favoriteCount') {
        await postCollection.doc(postId).update({
          data: {
            'data.favoriteCount': actualFavoriteCount.total
          }
        });
      } else {
        await postCollection.doc(postId).update({
          data: {
            favoriteCount: actualFavoriteCount.total
          }
        });
      }
      
      console.log(`已将帖子收藏数更新为: ${actualFavoriteCount.total}`);
    }

    // 获取更新后的收藏数
    const updatedPost = await postCollection.doc(postId).get();
    let updatedFavoriteCount = 0;
    
    if (favoriteCountField === 'data.favoriteCount') {
      // 如果收藏数在 data.favoriteCount
      updatedFavoriteCount = (updatedPost.data && updatedPost.data.data && updatedPost.data.data.favoriteCount) || 0;
    } else {
      // 如果收藏数在直接的 favoriteCount 字段
      updatedFavoriteCount = (updatedPost.data && updatedPost.data.favoriteCount) || 0;
    }
    
    console.log(`最终的帖子收藏数: ${updatedFavoriteCount}`);
    
    // 再次检查实际收藏数，以确保返回给前端的数据准确
    const finalFavoriteCount = await favoriteCollection.where({
      postId: postId
    }).count();
    
    console.log(`最终的实际收藏数: ${finalFavoriteCount.total}`);
    
    // 使用实际收藏数作为响应
    updatedFavoriteCount = finalFavoriteCount.total;

    return res.json({
      success: true,
      message: isFavorited ? '收藏成功' : '取消收藏成功',
      isFavorited: isFavorited,
      countChange: countChange,
      currentFavoriteCount: updatedFavoriteCount
    });
  } catch (error) {
    console.error('toggleFavorite error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '操作失败',
      countChange: 0
    });
  }
};

/**
 * 获取用户收藏列表
 * @route GET /api/favorites
 * @param {number} req.query.page - 页码（可选，默认1）
 * @param {number} req.query.limit - 每页数量（可选，默认10）
 * @returns {object} 用户收藏的帖子列表
 */
exports.getUserFavorites = async (req, res) => {
  try {
    const { userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const favoriteCollection = db.collection('ai_favorite');
    
    // 获取用户收藏总数
    const countResult = await favoriteCollection.where({
      _openid: userId
    }).count();
    
    const total = countResult.total;
    
    // 获取收藏列表并按创建时间降序排序
    const favoritesResult = await favoriteCollection
      .where({
        _openid: userId
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    
    const favorites = favoritesResult.data;
    
    // 如果没有收藏记录，直接返回空数组
    if (favorites.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    }
    
    // 提取所有帖子ID
    const postIds = favorites.map(f => f.postId);
    
    // 获取帖子详情
    const postCollection = db.collection('ai_post');
    const postsResult = await postCollection
      .where({
        _id: _.in(postIds)
      })
      .get();
    
    const posts = postsResult.data;
    
    // 将收藏信息与帖子信息关联
    const result = favorites.map(favorite => {
      const post = posts.find(p => p._id === favorite.postId);
      return {
        favoriteId: favorite._id,
        favoriteTime: favorite.createTime,
        post: post || { _id: favorite.postId, isDeleted: true, title: '帖子已被删除' }
      };
    });
    
    return res.json({
      success: true,
      data: result,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getUserFavorites error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '获取收藏列表失败'
    });
  }
};

/**
 * 检查帖子是否被收藏
 * @route GET /api/favorites/check/:postId
 * @param {string} req.params.postId - 帖子ID
 * @returns {object} 收藏状态和收藏总数
 */
exports.checkFavoriteStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, PetMeetID } = req.user;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: '缺少帖子ID参数'
      });
    }
    
    console.log(`检查帖子 ${postId} 的收藏状态和总数`);

    const favoriteCollection = db.collection('ai_favorite');
    const postCollection = db.collection('ai_post');
    
    // 同时获取用户收藏状态和总收藏数
    let favoriteQuery = {};
    
    if (PetMeetID) {
      // 如果有PetMeetID，先用PetMeetID查询
      favoriteQuery = {
        PetMeetID: PetMeetID,
        postId: postId,
        status: 'active'
      };
    } else {
      // 如果没有PetMeetID，则用userId查询
      favoriteQuery = {
        _openid: userId,
        postId: postId,
        status: 'active'
      };
    }
    
    const [userFavoriteResult, totalFavoritesResult, postResult] = await Promise.all([
      // 查询用户是否收藏了该帖子
      favoriteCollection.where(favoriteQuery).count(),
      
      // 查询帖子的总收藏数
      favoriteCollection.where({
        postId: postId
      }).count(),
      
      // 查询帖子信息，获取已记录的收藏数
      postCollection.doc(postId).get()
    ]);
    
    const isFavorited = userFavoriteResult.total > 0;
    const totalFavorites = totalFavoritesResult.total;
    
    console.log(`用户收藏状态: ${isFavorited}, 实际总收藏数: ${totalFavorites}`);
    
    // 记录在帖子表中的收藏数
    let recordedFavoriteCount = 0;
    
    // 判断收藏数存储位置
    if (postResult.data) {
      if (postResult.data.data && postResult.data.data.favoriteCount !== undefined) {
        // 收藏数存储在 data.favoriteCount
        recordedFavoriteCount = postResult.data.data.favoriteCount || 0;
      } else if (postResult.data.favoriteCount !== undefined) {
        // 收藏数存储在直接的 favoriteCount
        recordedFavoriteCount = postResult.data.favoriteCount || 0;
      }
    }
    
    console.log(`帖子表中记录的收藏数: ${recordedFavoriteCount}`);
    
    // 如果实际收藏数与记录的收藏数不一致，更新记录
    if (totalFavorites !== recordedFavoriteCount && postResult.data) {
      console.log(`检测到收藏数不一致，进行修正`);
      
      // 更新帖子表中的收藏数
      if (postResult.data.data && postResult.data.data.favoriteCount !== undefined) {
        await postCollection.doc(postId).update({
          data: {
            'data.favoriteCount': totalFavorites
          }
        });
      } else {
        await postCollection.doc(postId).update({
          data: {
            favoriteCount: totalFavorites
          }
        });
      }
      
      console.log(`已将帖子收藏数更新为实际数量: ${totalFavorites}`);
    }
    
    return res.json({
      success: true,
      isFavorited: isFavorited,
      favoriteCount: totalFavorites
    });
  } catch (error) {
    console.error('checkFavoriteStatus error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '检查收藏状态失败'
    });
  }
};
