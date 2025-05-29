const { getDatabase, getCloudBase } = require('../config/cloudbaseConfig');
const _ = require('lodash');

const db = getDatabase();
const $ = db.command.aggregate;

// 错误码定义
const ErrorCode = {
  PARAM_INVALID: 2001,
  USER_NOT_FOUND: 2002,
  DATABASE_ERROR: 2003,
  UNAUTHORIZED: 2004
};

/**
 * 获取用户关注列表的聚合管道
 * @param {string} currentUserOpenid 当前用户openid
 * @param {string} [currentUserPetMeetID] 当前用户PetMeetID
 * @returns {Promise<Array>} 关注用户ID列表
 */
async function getFollowingList(currentUserOpenid, currentUserPetMeetID) {
  try {
    // 构建查询条件，优先使用PetMeetID
    let matchCondition = {};
    
    if (currentUserPetMeetID) {
      // 如果有PetMeetID，优先使用
      matchCondition = { followerPetMeetID: currentUserPetMeetID };
    } else {
      // 如果没有PetMeetID，使用openid
      matchCondition = { followerOpenid: currentUserOpenid };
    }
    
    const followingRes = await db.collection('ai_follow')
      .aggregate()
      .match(matchCondition)
      .project({
        _id: 0,
        followingOpenid: 1
      })
      .group({
        _id: null,
        followingList: $.addToSet('$followingOpenid')
      })
      .end();

    return followingRes.list?.[0]?.followingList || [];
  } catch (error) {
    console.error('获取关注列表失败:', error);
    return [];
  }
}

/**
 * 构建基础查询条件
 * @param {boolean} isAdultMode 是否成人模式
 * @param {string} currentUserOpenid 当前用户openid
 * @returns {Object} 查询条件
 */
function buildBaseQuery(isAdultMode, currentUserOpenid) {
  // 只查询内容类型符合的已审核帖子
  const query = { status: 'approved' };
  
  // 设置内容类型(成人/标准)
  query.contentType = isAdultMode ? 'adult' : 'standard';
  
  // 设置权限过滤条件：公开帖子 + 用户自己的所有帖子
  if (currentUserOpenid) {
    // 用户已登录：可以看到公开帖子，自己的所有帖子，以及好友可见的帖子(需要单独处理)
    query.$or = [
      { permission: 'public' },
      { _openid: currentUserOpenid } // 自己的所有帖子都可见
    ];
  } else {
    // 未登录：只能看到公开帖子
    query.permission = 'public';
  }
  
  return query;
}

/**
 * 获取带点赞/收藏状态的帖子列表
 * @param {Object} query 查询条件
 * @param {number} pageSize 每页数量
 * @param {number} skip 跳过数量
 * @param {string} currentUserOpenid 当前用户openid
 * @param {string} [currentUserPetMeetID] 当前用户PetMeetID
 * @returns {Promise<{posts: Array, hasMore: boolean}>} 帖子列表和是否有更多
 */
async function getPostsWithInteractions(query, pageSize, skip, currentUserOpenid, currentUserPetMeetID) {
  try {
    console.log('[getPostsWithInteractions] 开始查询，参数：', { query, pageSize, skip });
    
    // 先尝试直接使用高效的普通查询
    try {
      console.log('[getPostsWithInteractions] 尝试直接查询...');
      const normalQuery = await db.collection('ai_post')
        .where(query)
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize + 1)
        .get();
      
      let posts = normalQuery.data || [];
      console.log(`[getPostsWithInteractions] 直接查询结果数量: ${posts.length}`);
      
      // 判断是否有更多数据
      const hasMore = posts.length > pageSize;
      if (hasMore) {
        posts.pop(); // 移除多余的一条数据
      }
      
      // 添加点赞和收藏状态
      if (currentUserOpenid && posts.length > 0) {
        // 获取帖子ID列表
        const postIds = posts.map(post => post._id);
        
        // 查询用户已点赞的帖子
        const likedQuery = await db.collection('ai_like')
          .where({
            postId: db.command.in(postIds),
            _openid: currentUserOpenid
          })
          .get();
        
        // 查询用户已收藏的帖子
        const favoritedQuery = await db.collection('ai_favorite')
          .where({
            postId: db.command.in(postIds),
            _openid: currentUserOpenid
          })
          .get();
        
        // 创建点赞和收藏集合
        const likedSet = new Set(likedQuery.data.map(like => like.postId));
        const favoritedSet = new Set(favoritedQuery.data.map(fav => fav.postId));
        
        // 给帖子添加交互状态
        posts = posts.map(post => ({
          ...post,
          isLiked: likedSet.has(post._id),
          isFavorited: favoritedSet.has(post._id)
        }));
      } else {
        // 用户未登录，设置默认状态
        posts = posts.map(post => ({
          ...post,
          isLiked: false,
          isFavorited: false
        }));
      }
      
      return { posts, hasMore };
    } catch (err) {
      console.error('[getPostsWithInteractions] 直接查询失败:', err);
      // 如果直接查询失败，回退到联合查询
    }
    
    // 回退方案：使用联合查询
    console.log('[getPostsWithInteractions] 尝试使用联合查询...');
    let aggregatePipeline = db.collection('ai_post')
      .aggregate()
      .match(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize + 1); // 多取一条用于判断 hasMore

    // 只有在用户登录时才进行点赞和收藏状态的查询
    if (currentUserOpenid) {
      aggregatePipeline = aggregatePipeline
        .lookup({
          from: 'ai_like',
          let: { postId: '$_id' },
          pipeline: $.pipeline()
            .match({
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$postId'] },
                  { $eq: ['$_openid', currentUserOpenid] }
                ]
              }
            })
            .project({ _id: 1 })
            .done(),
          as: 'likes'
        })
        .lookup({
          from: 'ai_favorite',
          let: { postId: '$_id' },
          pipeline: $.pipeline()
            .match({
              $expr: {
                $and: [
                  { $eq: ['$postId', '$$postId'] },
                  { $eq: ['$_openid', currentUserOpenid] }
                ]
              }
            })
            .project({ _id: 1 })
            .done(),
          as: 'favorites'
        })
        .addFields({
          isLiked: { $gt: [{ $size: '$likes' }, 0] },
          isFavorited: { $gt: [{ $size: '$favorites' }, 0] }
        });
    } else {
      aggregatePipeline = aggregatePipeline.addFields({
        isLiked: false,
        isFavorited: false
      });
    }

    // 执行联合查询
    const result = await aggregatePipeline.end();
    console.log('[getPostsWithInteractions] 联合查询结果:', result);
    
    let posts = result.list || [];
    console.log(`[getPostsWithInteractions] 联合查询结果数量: ${posts.length}`);
    
    // 判断是否有更多数据
    const hasMore = posts.length > pageSize;
    if (hasMore) {
      posts.pop(); // 移除多余的一条数据
    }

    // 清理不需要的字段
    posts = posts.map(post => {
      const { likes, favorites, ...rest } = post;
      return rest;
    });

    return { posts, hasMore };
  } catch (error) {
    console.error('获取帖子列表失败:', error);
    throw new Error('获取帖子列表失败');
  }
}

/**
 * 获取帖子流
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const getPostFeed = async (req, res) => {
  try {
    // 添加环境信息调试
    const app = getCloudBase();
    const envId = process.env.CLOUDBASE_ENV_ID || '未配置';
    console.log(`[getPostFeed] 当前使用的环境ID: ${envId}`);

    // 1. 获取调用者信息 (允许为空)
    const currentUserOpenid = req.user?.userId;
    const userPetMeetID = req.user?.PetMeetID;
    console.log(`[getPostFeed] 请求用户 ID: ${currentUserOpenid || '未登录'}, PetMeetID: ${userPetMeetID || '无'}`);

    // 2. 参数校验
    const { feedType = 'global', page = 1, pageSize = 10, adultModeEnabled } = req.query;
    
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const isAdultMode = adultModeEnabled === 'true';
    
    if (isNaN(pageNum) || pageNum <= 0 || isNaN(pageSizeNum) || pageSizeNum <= 0) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '参数无效或类型错误'
      });
    }
    
    const skip = (pageNum - 1) * pageSizeNum;

    // 3. 构建基础查询 - 传入用户ID
    const baseQuery = buildBaseQuery(isAdultMode, currentUserOpenid);
    console.log('[getPostFeed] 基础查询条件:', JSON.stringify(baseQuery, null, 2));

    // 4. 处理不同 Feed 类型
    let finalQuery = { ...baseQuery };
    
    // 5. 如果用户已登录，获取好友列表，以查询"仅好友可见"的帖子
    if (currentUserOpenid) {
      try {
        // 查询当前用户的好友列表（关注了当前用户的人）
        const friendsResult = await db.collection('ai_follow')
          .where({
            followingOpenid: currentUserOpenid  // 当前用户是被关注者
          })
          .get();
        
        // 提取所有关注当前用户的用户ID (即好友)
        const friendsOpenidList = friendsResult.data.map(item => item.followerOpenid);
        
        // 如果用户有好友，添加"好友可见"的条件
        if (friendsOpenidList.length > 0) {
          finalQuery.$or.push({
            permission: 'friends',
            _openid: _.in(friendsOpenidList)
          });
        }
        
        console.log(`[getPostFeed] 用户好友数量: ${friendsOpenidList.length}`);
      } catch (err) {
        console.error('[getPostFeed] 获取好友列表失败:', err);
        // 获取好友列表失败，继续处理已有条件
      }
    }
    
    // 6. 处理关注流
    if (feedType === 'following') {
      // 如果请求关注流，但用户未登录，则返回空列表
      if (!currentUserOpenid) {
        console.log('[getPostFeed] 用户未登录，无法获取关注流');
        return res.json({ 
          success: true, 
          code: 0, 
          message: '未登录', 
          data: { list: [], hasMore: false } 
        });
      }

      // 用户已登录，继续获取关注列表
      const followingList = await getFollowingList(currentUserOpenid, currentUserPetMeetID);

      if (!followingList.length) {
        return res.json({ 
          success: true, 
          code: 0, 
          message: '成功', 
          data: { list: [], hasMore: false } 
        });
      }
      
      // 将关注流查询条件合并到现有查询中
      if (finalQuery.$or) {
        // 修改每个$or条件，添加_openid限制
        const originalOr = [...finalQuery.$or];
        finalQuery.$or = [];
        
        originalOr.forEach(condition => {
          if (condition.permission === 'public') {
            // 公开帖子，关注用户和自己的都显示
            const userList = [...followingList];
            // 添加自己的openid，确保自己的帖子也可见
            if (!userList.includes(currentUserOpenid)) {
              userList.push(currentUserOpenid);
            }
            finalQuery.$or.push({
              ...condition,
              _openid: _.in(userList),
              PetMeetID: _.in([currentUserPetMeetID])
            });
          } else if (condition._openid === currentUserOpenid) {
            // 自己的帖子，保留这个条件
            finalQuery.$or.push(condition);
          } else if (condition.permission === 'friends') {
            // 好友可见的帖子，但只看关注用户中的好友
            finalQuery.$or.push({
              ...condition,
              _openid: _.in(followingList),
              PetMeetID: _.in([currentUserPetMeetID])
            });
          }
        });
        
        // 如果没有任何条件，返回空列表
        if (finalQuery.$or.length === 0) {
          return res.json({ 
            success: true, 
            code: 0, 
            message: '成功', 
            data: { list: [], hasMore: false } 
          });
        }
      } else {
        // 如果没有权限条件，直接使用关注用户过滤
        finalQuery._openid = _.in(followingList);
        finalQuery.PetMeetID = _.in([userPetMeetID]);
      }
    } else if (feedType !== 'global') {
      return res.status(400).json({ 
        success: false, 
        code: ErrorCode.PARAM_INVALID, 
        message: `不支持的 feedType: ${feedType}` 
      });
    }

    // 7. 获取带交互状态的帖子
    console.log('[getPostFeed] 最终查询条件:', JSON.stringify(finalQuery, null, 2));
    
    // 先直接执行简单查询看看是否有数据
    try {
      const testCount = await db.collection('ai_post').count();
      console.log(`[getPostFeed] 数据库中帖文总数: ${testCount.total || 0}`);
      
      const testQuery = await db.collection('ai_post')
        .where({status: 'approved'})
        .limit(1)
        .get();
          console.log(`[getPostFeed] 查询结果数量: ${testQuery.data.length}`);
    if (testQuery.data.length > 0) {
      console.log(`[getPostFeed] 示例帖文ID: ${testQuery.data[0]._id}`);
    }
    } catch (e) {
      console.error('[getPostFeed] 测试查询失败:', e);
    }
    
    const { posts, hasMore } = await getPostsWithInteractions(
      finalQuery,
      pageSizeNum,
      skip,
      currentUserOpenid,
      userPetMeetID
    );
    
    console.log(`[getPostFeed] 查询返回帖文数量: ${posts?.length || 0}`);


    // 8. 返回统一成功结构
    return res.json({
      success: true,
      code: 0,
      message: '成功',
      data: {
        list: posts,
        hasMore: hasMore
      }
    });

  } catch (error) {
    console.error('获取帖子流失败:', error);
    return res.status(500).json({
      success: false,
      code: ErrorCode.DATABASE_ERROR,
      message: '服务器内部错误'
    });
  }
};

/**
 * 获取帖文详情
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const getPostDetail = async (req, res) => {
  try {
    // 1. 获取请求参数
    const { postId } = req.params;
    const adultModeEnabled = req.query.adultMode === 'true';
    
    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        code: ErrorCode.PARAM_INVALID, 
        message: '参数无效 (postId)' 
      });
    }

    // 2. 获取当前用户ID和PetMeetID（如果已登录）
    const currentUserOpenid = req.user?.userId || null;
    const userPetMeetID = req.user?.PetMeetID || null;
    
    // 记录请求开始
    console.log(`[Post Detail] 开始处理请求: postId=${postId}, adultMode=${adultModeEnabled}, 用户: ${currentUserOpenid || '未登录'}`);
    console.time(`postDetail-${postId}`); // 开始计时
    
    // 3. 查询帖子基础信息
    let post;
    try {
      console.log(`[Post Detail] 开始查询数据库，集合: ai_post, ID: ${postId}`);
      const postRes = await db.collection('ai_post').doc(postId).get();
      
      // 添加详细的响应日志
      console.log(`[Post Detail] 数据库查询响应:`, JSON.stringify({
        hasData: !!postRes,
        data: postRes ? postRes.data : null,
        errCode: postRes?.errCode,
        errMsg: postRes?.errMsg
      }, null, 2));
      
      // 检查 data 是否存在
      if (!postRes || !postRes.data || !Array.isArray(postRes.data) || postRes.data.length === 0) {
        console.log(`[Post Detail] 帖子 ${postId} 查询成功但未找到数据`);
        return res.status(404).json({ 
          success: false, 
          code: ErrorCode.PARAM_INVALID, 
          message: '帖子不存在或已被删除' 
        });
      }
      
      // 获取数组中的第一个文档
      post = postRes.data[0];
      console.log(`[Post Detail] 解析后的帖子数据:`, JSON.stringify(post, null, 2));
      console.log(`[Post Detail] 获取到帖子基础数据，ID: ${post._id}, 类型: ${post.contentType}, 状态: ${post.status}`);
      console.log(`[Post Detail] 帖子作者: ${post._openid}, 创建时间: ${post.createdAt}, 更新时间: ${post.updatedAt}`);
      console.log(`[Post Detail] 帖子权限: ${post.permission || 'public'}, 是否私密: ${post.isPrivate || false}`);
    } catch (dbError) {
      console.log(`数据库查询 postId: ${postId} 失败:`, dbError);

      // 区分错误类型
      if (dbError.errCode === -502004 || 
          dbError.code === 'DOCUMENT_NOT_FOUND' || 
          dbError.message?.includes('not found') || 
          dbError.message?.includes('does not exist')) {
        // "未找到" 错误
        return res.status(404).json({ 
          success: false, 
          code: ErrorCode.PARAM_INVALID, 
          message: '帖子不存在或已被删除' 
        });
      } else {
        // 其他数据库错误
        return res.status(500).json({ 
          success: false, 
          code: ErrorCode.DATABASE_ERROR, 
          message: '获取帖子数据时出错' 
        });
      }
    }

    // 4. 检查帖子状态
    if (post.status !== 'approved') {
      console.log(`帖子 ${postId} 状态为 ${post.status}，不可见`);
      return res.status(404).json({ 
        success: false, 
        code: ErrorCode.PARAM_INVALID, 
        message: '帖子正在审核中或已被屏蔽' 
      });
    }
    console.log(`[Post Detail] 帖子状态检查通过: ${post.status}, 标题: ${post.title || '无标题'}`);

    // 5. 查询点赞和关注状态
    let isLiked = false;
    let isFollowing = false;
    const authorOpenid = post._openid; // 获取帖子作者的 OpenID

    // 如果用户已登录，查询点赞状态
    if (currentUserOpenid) {
      try {
        const likeRes = await db.collection('ai_like').where({
          postId: postId,
          _openid: currentUserOpenid
        }).count();
        isLiked = likeRes.total > 0;
        console.log(`用户 ${currentUserOpenid} 对帖子 ${postId} 的点赞状态: ${isLiked}`);
      } catch (dbError) {
        console.error(`查询帖子 ${postId} 点赞状态失败:`, dbError);
        // 查询点赞失败不阻塞，保持 isLiked 为 false
      }

      // 查询关注状态（仅当作者不是当前用户时）
      if (authorOpenid && authorOpenid !== currentUserOpenid) {
        try {
          const followRes = await db.collection('ai_follow').where({
            followerOpenid: currentUserOpenid,
            followingOpenid: authorOpenid
          }).count();
          isFollowing = followRes.total > 0;
          console.log(`用户 ${currentUserOpenid} 对作者 ${authorOpenid} 的关注状态: ${isFollowing}`);
        } catch (dbError) {
          console.error(`查询用户 ${currentUserOpenid} 对作者 ${authorOpenid} 的关注状态失败:`, dbError);
          // 查询关注失败不阻塞，保持 isFollowing 为 false
        }
      }
    }

    // 6. 检查是否是视频帖文，获取视频详情
    if (post.isVideoPost === true) {
      try {
        console.log(`检测到视频帖文 ${postId}，获取相关视频信息`);
        const videoRes = await db.collection('ai_videos').where({
          postId: postId
        }).get();
        
        if (videoRes.data && videoRes.data.length > 0) {
          const videoData = videoRes.data[0];
          // 将视频信息添加到帖文中
          post.videoUrl = videoData.videoUrl || '';
          post.videoDuration = videoData.videoDuration || videoData.duration || 0;
          // 如果帖文中没有封面地址，使用视频集合中的封面
          if (!post.videoCoverUrl) {
            post.videoCoverUrl = videoData.coverUrl || '';
          }
          console.log(`成功获取视频信息: ${JSON.stringify(videoData)}`);
        } else {
          console.warn(`未找到帖文 ${postId} 对应的视频记录`);
        }
      } catch (error) {
        console.error(`获取视频信息失败:`, error);
        // 即使视频信息获取失败，仍然返回帖文信息
      }
    }
    
    // 7. 组合最终返回结果
    const postDetail = {
      ...post,
      isLiked: isLiked,
      isFollowing: isFollowing
    };

    // 8. 记录处理完成
    console.timeEnd(`postDetail-${postId}`);
    console.log(`[Post Detail] 请求处理完成，返回数据长度: ${JSON.stringify(postDetail).length} 字节`);
    
    // 9. 返回成功结果
    return res.status(200).json({
      success: true,
      code: 0,
      message: '成功',
      data: {
        post: postDetail,
        comments: [] // 添加空的 comments 数组以匹配前端期望
      }
    });

  } catch (error) {
    console.error(`[Post Detail] 处理失败 (postId: ${req.params.postId || 'N/A'}):`, error);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }

    let returnCode = ErrorCode.DATABASE_ERROR;
    let returnMessage = '获取帖子详情失败';

    // 如果错误本身带有 code 和 message，优先使用
    if (error.code && typeof error.code === 'number') {
      returnCode = error.code;
    }
    if (error.message) {
      returnMessage = error.message;
    }

    // 返回统一错误结构
    return res.status(500).json({
      success: false,
      code: returnCode,
      message: returnMessage
    });
  }
};

/**
 * 创建新帖子
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
/**
 * 创建新帖子
 * @route POST /post/create
 * @param {Object} req.body.post - 帖子数据
 * @returns {Object} 创建结果
 */
const createPost = async (req, res) => {
  try {
    console.log('收到创建帖子请求:', req.body);
    
    // 1. 获取用户信息 (从身份验证中间件)
    const currentUserOpenid = req.user.userId;
    const userPetMeetID = req.user.PetMeetID; // 添加PetMeetID支持
    
    if (!currentUserOpenid) {
      return res.status(401).json({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        message: '用户未登录'
      });
    }
    
    console.log(`用户 ${currentUserOpenid} 尝试创建帖子，PetMeetID: ${userPetMeetID || '无'}`);

    // 2. 获取请求数据
    const postData = req.body.post || {};

    // 3. 参数校验
    const validationResult = validatePostParams(postData);
    if (!validationResult.isValid) {
      console.log('帖子数据验证失败:', validationResult.errorMessage);
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: validationResult.errorMessage || '帖子数据格式错误或必填字段缺失'
      });
    }

    // 4. 获取用户资料
    console.log('获取用户资料:', currentUserOpenid);
    let userProfile = await getUserProfile(currentUserOpenid);
    
    // 如果是管理系统用户且没有找到用户资料，使用token中的信息
    if (!userProfile && req.user.isManager) {
      console.log('管理系统用户，使用token中的用户信息');
      userProfile = {
        nickName: req.user.authUser.nickName || '管理系统用户',
        avatarUrl: req.user.profileUser.avatarUrl || '',
        adultModeEnabled: false  // 管理系统用户默认不开启成人模式
      };
      console.log('使用的管理系统用户资料:', userProfile);
    }
    
    if (!userProfile) {
      console.error('未找到用户资料:', currentUserOpenid);
      return res.status(404).json({
        success: false,
        code: ErrorCode.USER_NOT_FOUND,
        message: '未找到用户信息'
      });
    }
    
    console.log('获取到用户资料:', userProfile.nickName);

    // 5. 处理内容类型
    const finalContentType = 
      ['standard', 'adult'].includes(postData.contentType)
        ? postData.contentType
        : (userProfile.adultModeEnabled ? 'adult' : 'standard');
    
    console.log('帖子内容类型:', finalContentType);

    // 6. 内容安全检查
    // 检查帖子内容是否包含敏感词
    const sensitiveWordsResult = await checkForSensitiveContent(postData.content, postData.title);
    if (sensitiveWordsResult.hasSensitiveContent) {
      console.log('内容检查失败，包含敏感词:', sensitiveWordsResult.detectedWords);
      return res.status(400).json({
        success: false,
        code: ErrorCode.CONTENT_INAPPROPRIATE,
        message: '内容包含敏感词汇，请修改后重新提交',
        data: { detectedWords: sensitiveWordsResult.detectedWords }
      });
    }

    // 7. 处理图片URL
    // 确保所有图片URL都有效
    if (postData.images && Array.isArray(postData.images)) {
      // 过滤无效的图片URL
      postData.images = postData.images.filter(url => {
        return typeof url === 'string' && url.trim().length > 0;
      });
      
      console.log(`处理后的图片数量: ${postData.images.length}`);
    }

    // 8. 写入数据库
    console.log('开始创建帖子记录...');
    const record = await createPostRecord(
      currentUserOpenid,
      userProfile,
      postData,
      'approved', // 默认审核通过
      finalContentType,
      userPetMeetID // 添加PetMeetID
    );
    
    // 从数据库返回结果中提取帖子ID
    const postId = record._id || record.id;
    console.log('帖子创建成功, ID:', postId);

    // 9. 更新用户发帖计数
    try {
      await updateUserPostCount(currentUserOpenid, 1);
      console.log(`更新用户 ${currentUserOpenid} 的发帖计数`);
    } catch (err) {
      console.error('更新用户发帖计数失败:', err);
      // 非关键错误，不影响主流程
    }

    return res.status(201).json({
      success: true,
      code: 0,
      message: '发布成功',
      data: { 
        postId: postId, 
        status: 'approved',
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('创建帖子失败:', error);
    
    // 返回适当的错误信息
    return res.status(500).json({
      success: false,
      code: error.code || ErrorCode.DATABASE_ERROR,
      message: error.message || '服务器内部错误'
    });
  }
};

/**
 * 验证帖子参数
 * @param {Object} postData 帖子数据
 * @returns {Object} 验证结果对象，包含 isValid 和可选的 errorMessage
 */
function validatePostParams(postData) {
  const CONTENT_MIN_LENGTH = 1;
  const CONTENT_MAX_LENGTH = 2000;
  const TITLE_MAX_LENGTH = 100;
  const MAX_IMAGES = 9;
  const MAX_TOPICS = 5;

  if (!postData) {
    return {
      isValid: false,
      errorMessage: '缺少帖子数据'
    };
  }

  // 内容验证
  if (!postData.content) {
    return {
      isValid: false,
      errorMessage: '帖子内容不能为空'
    };
  }
  
  if (typeof postData.content !== 'string') {
    return {
      isValid: false,
      errorMessage: '帖子内容必须是字符串'
    };
  }
  
  if (postData.content.length < CONTENT_MIN_LENGTH) {
    return {
      isValid: false,
      errorMessage: `帖子内容至少需要 ${CONTENT_MIN_LENGTH} 个字符`
    };
  }
  
  if (postData.content.length > CONTENT_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `帖子内容不能超过 ${CONTENT_MAX_LENGTH} 个字符`
    };
  }

  // 标题验证
  if (postData.title && typeof postData.title === 'string' && postData.title.length > TITLE_MAX_LENGTH) {
    return {
      isValid: false,
      errorMessage: `标题不能超过 ${TITLE_MAX_LENGTH} 个字符`
    };
  }

  // 图片验证
  if (postData.images) {
    if (!Array.isArray(postData.images)) {
      return {
        isValid: false,
        errorMessage: 'images 必须是数组'
      };
    }

    if (postData.images.length > MAX_IMAGES) {
      return {
        isValid: false,
        errorMessage: `图片数量不能超过 ${MAX_IMAGES} 张`
      };
    }
    
    // 验证每个图片URL是否为字符串
    for (const imgUrl of postData.images) {
      if (typeof imgUrl !== 'string' || imgUrl.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: '图片URL必须是非空字符串'
        };
      }
    }
  }
  
  // 话题验证
  if (postData.topics) {
    if (!Array.isArray(postData.topics)) {
      return {
        isValid: false,
        errorMessage: 'topics 必须是数组'
      };
    }
    
    if (postData.topics.length > MAX_TOPICS) {
      return {
        isValid: false,
        errorMessage: `话题数量不能超过 ${MAX_TOPICS} 个`
      };
    }
    
    // 验证每个话题是否为字符串
    for (const topic of postData.topics) {
      if (typeof topic !== 'string' || topic.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: '话题必须是非空字符串'
        };
      }
    }
  }
  
  // 权限验证
  if (postData.permission && !['public', 'friends', 'private'].includes(postData.permission)) {
    return {
      isValid: false,
      errorMessage: '无效的权限设置，必须是 public、friends 或 private'
    };
  }
  
  // 内容类型验证
  if (postData.contentType && !['standard', 'adult'].includes(postData.contentType)) {
    return {
      isValid: false,
      errorMessage: '无效的内容类型，必须是 standard 或 adult'
    };
  }

  // 所有检查通过
  return {
    isValid: true
  };
}

/**
 * 内容安全检查占位函数
 * 后期将使用其他服务实现
 * @param {string} content 帖子内容
 * @param {string} [title] 帖子标题
 * @returns {Object} 检查结果
 */
async function checkForSensitiveContent(content, title = '') {
  // 注意: 这个函数现在只是占位符，实际的敏感词检查将由外部服务提供
  console.log('内容安全检查已禁用，将在后期集成外部服务');
  
  // 始终返回安全结果
  return {
    hasSensitiveContent: false,
    detectedWords: []
  };
}

/**
 * 更新用户发帖计数
 * @param {string} userOpenid 用户ID
 * @param {number} increment 增量，正数表示增加，负数表示减少
 * @returns {Promise<void>}
 */
async function updateUserPostCount(userOpenid, increment = 1) {
  if (!userOpenid) {
    throw new Error('缺少用户ID');
  }

  try {
    // 更新用户资料中的发帖计数
    const userProfileCollection = db.collection('user_profile');
    
    // 查询用户资料
    const { data: profiles } = await userProfileCollection
      .where({ _openid: userOpenid })
      .get();
      
    if (!profiles || profiles.length === 0) {
      console.log(`用户 ${userOpenid} 的资料不存在，无法更新发帖计数`);
      return;
    }
    
    const profile = profiles[0];
    const currentStats = profile.stats || {};
    const currentPostCount = currentStats.postCount || 0;
    
    // 计算新的发帖计数，确保不会小于0
    const newPostCount = Math.max(0, currentPostCount + increment);
    
    // 更新数据库
    await userProfileCollection.doc(profile._id).update({
      'stats.postCount': newPostCount,
      updatedAt: db.serverDate()
    });
    
    console.log(`用户 ${userOpenid} 的发帖计数已更新为 ${newPostCount}`);
  } catch (error) {
    console.error('更新用户发帖计数失败:', error);
    throw error;
  }
}

/**
 * 获取用户资料
 * @param {string} openid 用户openid
 * @returns {Promise<Object>} 用户资料
 */
async function getUserProfile(openid) {
  try {
    const profile = db.collection('user_profile');
    const aiUser = db.collection('ai_user');

    const pick = data => (data && data[0]) || null;
    
    let user =
      pick((await profile.where({ _openid: openid }).limit(1).get()).data) ||
      (await profile.doc(openid).get().then(r => r.data).catch(() => null)) ||
      pick((await profile.where({ openid }).limit(1).get()).data) ||
      pick((await aiUser.where({ _openid: openid }).limit(1).get()).data) ||
      (await aiUser.doc(openid).get().then(r => r.data).catch(() => null));

    if (!user) {
      return null;
    }

    // 提取用户资料
    const nickName = user.nickname || user.nickName || user.nick_name || user.name ||
      (user.userInfo?.nickName) || '匿名用户';
    const avatarUrl = user.avatarUrl || user.avatar_url || user.avatar ||
      (user.userInfo?.avatarUrl) || '';
      
    return {
      nickName,
      avatarUrl,
      adultModeEnabled: user.adultModeEnabled || false
    };
  } catch (error) {
    console.error('获取用户资料失败:', error);
    return null;
  }
}

/**
 * 创建帖子记录
 * @param {string} openid 用户openid
 * @param {Object} userInfo 用户信息
 * @param {Object} postData 帖子数据
 * @param {string} status 状态
 * @param {string} contentType 内容类型
 * @param {string} PetMeetID 用户PetMeetID
 * @returns {Promise<Object>} 创建的记录
 */
async function createPostRecord(openid, userInfo, postData, status, contentType, PetMeetID) {
  const safeUserInfo = {
    nickName: userInfo?.nickName || '匿名用户',
    avatarUrl: userInfo?.avatarUrl || ''
  };

  const record = {
    _openid: openid,
    PetMeetID: PetMeetID, // 添加PetMeetID字段
    userInfo: safeUserInfo,
    title: postData.title || '',
    content: postData.content,
    images: postData.images || [],
    location: postData.location || null,
    topics: postData.topics || [],
    permission: postData.permission || 'public',
    longPost: postData.longPost || '',
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    // 强制使用服务器时间，忽略前端传入的时间字段
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    status,
    contentType,
    // 添加额外字段以与现有数据结构保持一致
    hasAutoTags: false,
    autoTagGeneratedAt: db.serverDate(),
    data: {
      favoriteCount: 0
    }
  };

  if (contentType === 'adult' && postData.breedingRequirements) {
    record.breedingRequirements = postData.breedingRequirements;
  }

  try {
    // 直接写入record对象，而不是嵌套在data中
    const result = await db.collection('ai_post').add(record);
    console.log('数据库添加结果:', result);
    
    // 返回包含ID的对象
    return {
      _id: result._id || result.id,
      ...result
    };
  } catch (e) {
    console.error('数据库写入失败:', e);
    throw { code: ErrorCode.DATABASE_ERROR, message: '数据保存失败' };
  }
}

/**
 * 更新帖文
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const updateData = req.body;
    const currentUserOpenid = req.user.userId;
    
    console.log(`用户 ${currentUserOpenid} 尝试更新帖文 ${postId}`);
    
    if (!postId) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '帖文ID不能为空'
      });
    }
    
    // 1. 获取原帖文数据
    let post;
    try {
      const postRes = await db.collection('ai_post').doc(postId).get();
      if (!postRes || !postRes.data || !Array.isArray(postRes.data) || postRes.data.length === 0) {
        return res.status(404).json({
          success: false,
          code: ErrorCode.PARAM_INVALID,
          message: '帖文不存在或已被删除'
        });
      }
      post = postRes.data[0];
    } catch (error) {
      console.error('获取帖文数据失败:', error);
      return res.status(500).json({
        success: false,
        code: ErrorCode.DATABASE_ERROR,
        message: '获取帖文数据失败'
      });
    }
    
    // 2. 验证权限
    if (post._openid !== currentUserOpenid && !req.user.isManager) {
      return res.status(403).json({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        message: '无权修改此帖文'
      });
    }
    
    // 3. 构建更新数据
    const allowedFields = ['title', 'content', 'images', 'topics', 'permission', 'longPost', 'location'];
    const updateFields = {};
    
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        updateFields[field] = updateData[field];
      }
    });
    
    // 添加更新时间
    updateFields.updatedAt = new Date().toISOString();
    
    console.log('更新字段:', updateFields);
    
    // 4. 执行更新
    try {
      await db.collection('ai_post').doc(postId).update(updateFields);
      console.log(`帖文 ${postId} 更新成功`);
      
      // 5. 获取更新后的帖文数据
      const updatedPostRes = await db.collection('ai_post').doc(postId).get();
      const updatedPost = updatedPostRes.data[0];
      
      return res.json({
        success: true,
        code: 0,
        message: '帖文更新成功',
        data: {
          post: updatedPost
        }
      });
    } catch (error) {
      console.error('更新帖文失败:', error);
      return res.status(500).json({
        success: false,
        code: ErrorCode.DATABASE_ERROR,
        message: '更新帖文失败'
      });
    }
  } catch (error) {
    console.error('更新帖文异常:', error);
    return res.status(500).json({
      success: false,
      code: ErrorCode.DATABASE_ERROR,
      message: '服务器内部错误'
    });
  }
};

/**
 * 删除帖文
 * @route DELETE /posts/:postId
 * @param {string} req.params.postId - 帖文ID
 * @returns {Object} 删除结果
 */
const deletePost = async (req, res) => {
  try {
    // 1. 获取帖文ID和当前用户ID
    const postId = req.params.postId;
    console.log('收到的帖文ID参数:', postId);
    const currentUserOpenid = req.user.userId;
    const userPetMeetID = req.user.PetMeetID;
    
    if (!postId) {
      return res.status(400).json({
        success: false,
        message: '缺少帖文ID'
      });
    }
    
    if (!currentUserOpenid) {
      return res.status(401).json({
        success: false,
        message: '用户未登录'
      });
    }
    
    console.log(`用户 ${currentUserOpenid} 尝试删除帖文 ${postId}`);
    
    // 2. 查询帖文，确认存在性和所有权
    console.log('查询帖文记录，ID:', postId);
    
    // 首先尝试使用 doc() 方法读取帖文
    const postRef = db.collection('ai_post').doc(postId);
    let postData;
    let post = null;
    
    try {
      // 获取帖文数据
      const postData = await postRef.get();
      console.log('原始帖文数据:', JSON.stringify(postData));
      if (postData && postData.data) {
        // 处理数据结构 - 可能是对象或数组
        if (Array.isArray(postData.data)) {
          // 如果是数组，取第一个元素
          if (postData.data.length > 0) {
            post = postData.data[0];
            console.log('帖文数据是数组，取第一个元素:', JSON.stringify(post));
          } else {
            post = null;
            console.log('帖文数据数组为空');
          }
        } else {
          // 如果是对象，直接使用
          post = postData.data;
          console.log('帖文数据是对象:', JSON.stringify(post));
        }
        
        console.log('已获取帖文数据:', { id: postId, hasData: !!post });
      } else {
        console.log('无法使用doc()获取帖文数据，尝试其他方法');
      }
    } catch (error) {
      console.error('使用doc()获取帖文数据时出错:', error);
    }
    
    // 如果使用doc()方法失败，尝试使用where查询
    if (!post) {
      try {
        console.log('尝试使用where查询帖文...');
        const queryResult = await db.collection('ai_post')
          .where({
            _id: postId
          })
          .get();
        
        if (queryResult && queryResult.data && queryResult.data.length > 0) {
          post = queryResult.data[0];
          console.log('通过where查询成功获取帖文:', { id: postId, hasData: !!post });
        } else {
          console.log('无法通过where查询获取帖文数据');
        }
      } catch (error) {
        console.error('使用where获取帖文数据时出错:', error);
      }
    }
    
    // 如果找不到帖文，直接返回404错误
    
    // 如果仍然无法获取帖文数据，返回404错误
    if (!post) {
      return res.status(404).json({
        success: false,
        message: '帖文不存在或已被删除'
      });
    }
    
    // 处理可能的数组结构
    if (Array.isArray(post)) {
      console.log('帖文数据是数组格式，长度:', post.length);
      if (post.length > 0) {
        post = post[0]; // 取数组的第一个元素
        console.log('处理后的帖文数据:', JSON.stringify(post));
      } else {
        console.log('帖文数据数组为空');
        return res.status(404).json({
          success: false,
          message: '帖文不存在或已被删除'
        });
      }
    }
    
    // 输出帖文数据中的所有字段名，帮助识别数据结构
    console.log('帖文数据字段名列表:', Object.keys(post));
    
    // 3. 检查所有权，允许帖文作者删除，充分支持不同的数据结构
    let postOpenid = null;
    let postPetMeetID = null;
    
    // 检查不同可能的字段名
    if (post._openid) {
      postOpenid = post._openid;
    } else if (post.openid) {
      postOpenid = post.openid;
    } else if (post.userId) {
      postOpenid = post.userId;
    } else if (post.author && post.author._openid) {
      postOpenid = post.author._openid;
    }
    
    if (post.PetMeetID) {
      postPetMeetID = post.PetMeetID;
    } else if (post.petMeetID) {
      postPetMeetID = post.petMeetID;
    } else if (post.userInfo && post.userInfo.PetMeetID) {
      postPetMeetID = post.userInfo.PetMeetID;
    }
    
    console.log('提取的帖文所有者信息:', {
      postOpenid,
      postPetMeetID,
    });
    
    // 验证帖文所有权
    
    const postBelongsToCurrentUser = (
      // 检查openid是否匹配
      (postOpenid && postOpenid === currentUserOpenid) ||
      // 检查PetMeetID是否匹配
      (postPetMeetID && userPetMeetID && postPetMeetID === userPetMeetID) ||
      // 管理员用户可以删除任何帖文 - 修正权限检查字段
      (req.user.role === 'admin')
    );
    
    console.log('帖文所有权检查结果:', {
      postOpenid,
      currentUserOpenid,
      postPetMeetID,
      userPetMeetID,
      userRole: req.user.role,
      isAdmin: req.user.role === 'admin',
      belongsToUser: postBelongsToCurrentUser
    });
    
    if (!postBelongsToCurrentUser) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除该帖文'
      });
    }
    
    // 4. 删除帖文
    try {
      await postRef.remove();
      console.log('帖文删除成功:', postId);
      
      // 5. 如果帖文有图片，删除图片资源（可以异步处理）
      if (post.images && post.images.length > 0) {
        try {
          const { getCloudBase } = require('../config/cloudbaseConfig');
          const app = getCloudBase();
          
          app.deleteFile({
            fileList: post.images
          }).then(res => {
            console.log('删除帖文相关图片成功:', res);
          }).catch(err => {
            console.error('删除帖文相关图片失败:', err);
          });
        } catch (error) {
          console.error('删除帖文图片失败，但不影响帖文删除:', error);
        }
      }
      
      // 6. 成功删除后更新用户发帖计数（可选）
      try {
        await updateUserPostCount(post._openid, -1); // 减少1
      } catch (error) {
        console.error('更新用户发帖计数失败:', error);
        // 不影响主流程
      }
      
      // 7. 返回成功响应
      return res.status(200).json({
        success: true,
        message: '帖文删除成功',
        data: { postId }
      });
    } catch (error) {
      console.error('删除帖文时出错:', error);
      return res.status(500).json({
        success: false,
        message: '删除帖文时出错',
        error: error.message
      });
    }
    
  } catch (error) {
    console.error('删除帖文失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
};

// 导出函数 - 单独导出每个函数
module.exports.getPostFeed = getPostFeed;
module.exports.getPostDetail = getPostDetail;
module.exports.createPost = createPost;
module.exports.deletePost = deletePost;
module.exports.updatePost = updatePost;
