const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

// 错误码定义
const ErrorCode = {
  PARAM_INVALID: 7001,    // 输入参数无效
  USER_NOT_FOUND: 7002,   // 获取当前用户信息失败
  DATABASE_ERROR: 7003,   // 数据库操作失败
  UNAUTHORIZED: 7004,     // 用户未登录
  POST_NOT_FOUND: 7005,   // 帖子不存在
  REPLY_NOT_FOUND: 7006,  // 回复的评论不存在
  CONTENT_INVALID: 7007   // 内容无效或不符合要求
};

/**
 * 获取帖子评论列表
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
const getComments = async (req, res) => {
  try {
    // 1. 获取并校验输入参数
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const adultModeEnabled = req.query.adultMode === 'true';
    
    if (!postId || typeof postId !== 'string' || page <= 0 || pageSize <= 0) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '参数无效 (postId, page, pageSize)'
      });
    }
    
    const skip = (page - 1) * pageSize;
    
    // 2. 获取当前用户ID和PetMeetID（如果已登录）
    const currentUserOpenid = req.user?.userId || null;
    const currentUserPetMeetID = req.user?.PetMeetID || null;
    
    // 记录请求开始
    console.log(`[Comments] 开始处理请求: postId=${postId}, page=${page}, pageSize=${pageSize}, adultMode=${adultModeEnabled}, 用户: ${currentUserOpenid || '未登录'}`);
    console.time(`getComments-${postId}-${page}`);
    
    // 3. 构建查询条件
    const query = {
      postId: postId,
      status: 'approved'
    };
    
    // 4. 根据用户模式过滤 contentType
    if (!adultModeEnabled) {
      query.contentType = 'standard';
      console.log('用户未开启成人模式，只查询 standard 评论');
    } else {
      console.log('用户已开启成人模式，查询所有评论');
      // 成人模式时不需要额外过滤
    }
    
    // 5. 执行数据库查询获取评论列表
    let comments = [];
    let hasMore = false;
    try {
      const commentsRes = await db.collection('ai_comment')
        .where(query)
        .orderBy('createdAt', 'asc') // 评论通常按时间升序排列
        .skip(skip)
        .limit(pageSize + 1) // 多查一条用于判断 hasMore
        .get();
      
      comments = commentsRes.data;
      
      // 6. 判断是否还有更多页
      if (comments.length > pageSize) {
        hasMore = true;
        comments.pop(); // 移除多查的那一条
      }
      
      console.log(`查询到 ${comments.length} 条评论`);
      
      // 6.1 确保评论数据中包含_openid字段，这对前端识别用户自己的评论很重要
      comments = comments.map(comment => {
        // 确保主评论有_openid
        const commentCopy = { ...comment };
        
        // 处理回复评论的_openid
        if (commentCopy.replies && Array.isArray(commentCopy.replies)) {
          commentCopy.replies = commentCopy.replies.map(reply => {
            // 确保回复评论也有_openid
            return { ...reply };
          });
        }
        
        return commentCopy;
      });
      
    } catch (dbError) {
      console.error(`查询帖子 ${postId} 的评论失败:`, dbError);
      return res.status(500).json({
        success: false,
        code: ErrorCode.DATABASE_ERROR,
        message: '获取评论列表失败'
      });
    }
    
    // 7. 记录计时结束
    console.timeEnd(`getComments-${postId}-${page}`);
    
    // 8. 返回结果
    return res.status(200).json({
      success: true,
      data: {
        comments: comments,
        hasMore: hasMore
      }
    });
    
  } catch (error) {
    console.error(`getComments 执行失败 (postId: ${req.params.postId || 'N/A'}):`, error);
    return res.status(500).json({
      success: false,
      code: ErrorCode.DATABASE_ERROR,
      message: '获取评论列表失败'
    });
  }
};

/**
 * 添加评论
 * @route POST /api/comments
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<Object>} 评论创建结果
 */
const addComment = async (req, res) => {
  try {
    // 1. 确保用户已登录
    const userId = req.user?.userId;
    const PetMeetID = req.user?.PetMeetID; // 获取PetMeetID
    
    console.log(`添加评论，用户ID: ${userId}, PetMeetID: ${PetMeetID}`);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        message: '请先登录'
      });
    }

    // 2. 参数校验
    const { postId, content, replyToCommentId, replyToOpenid } = req.body;

    // 检查必要参数
    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '缺少或无效的 postId'
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '评论内容不能为空'
      });
    }

    // 检查内容长度
    const MAX_COMMENT_LENGTH = 500;
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.CONTENT_INVALID,
        message: `评论最多 ${MAX_COMMENT_LENGTH} 字`
      });
    }

    // 检查回复参数的一致性
    const hasReplyCommentId = !!replyToCommentId;
    const hasReplyOpenid = !!replyToOpenid;
    if (hasReplyCommentId !== hasReplyOpenid) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: 'replyToCommentId 和 replyToOpenid 必须同时提供或同时缺失'
      });
    }

    // 3. 使用事务执行数据库操作
    const transaction = await db.startTransaction();
    try {
      // 3.1 查询帖子是否存在且已通过审核
      const postDoc = await transaction.collection('ai_post')
        .doc(postId)
        .field({ status: true, contentType: true })
        .get();
      
      if (!postDoc.data || postDoc.data.status !== 'approved') {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          code: ErrorCode.POST_NOT_FOUND,
          message: '帖子不存在或不可评论'
        });
      }

      // 3.2 查询用户信息
      const userSnap = await transaction.collection('user_profile')
        .where({ _openid: userId })
        .field({ nickName: true, avatarUrl: true })
        .limit(1)
        .get();
      
      if (userSnap.data.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          code: ErrorCode.USER_NOT_FOUND,
          message: '用户信息缺失'
        });
      }
      
      const userInfo = userSnap.data[0];

      // 3.3 如果是回复其他评论，检查目标评论是否存在
      if (replyToCommentId) {
        const replyDoc = await transaction.collection('ai_comment')
          .doc(replyToCommentId)
          .field({ _id: true })
          .get();
        
        if (!replyDoc.data) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            code: ErrorCode.REPLY_NOT_FOUND,
            message: '回复目标评论不存在'
          });
        }
      }

      // 3.4 创建评论对象
      const trimmedContent = content.trim();
      const now = new Date();
      const comment = {
        postId,
        _openid: userId,
        PetMeetID: PetMeetID, // 添加顶级PetMeetID字段
        userInfo: userId ? {
          _openid: userId,
          PetMeetID: PetMeetID, // 使用正确的PetMeetID变量
          nickName: req.user?.authUser?.nickName || '匿名用户',
          avatarUrl: req.user?.profileUser?.avatarUrl || ''
        } : null,
        content: trimmedContent,
        replyToCommentId: replyToCommentId || null,
        replyToOpenid: replyToOpenid || null,
        status: 'approved',  // 直接设置为已审核状态
        contentType: postDoc.data.contentType || 'standard',
        createdAt: now
      };

      // 3.5 写入评论
      const addRes = await transaction.collection('ai_comment').add(comment);

      // 3.6 更新帖子评论数
      await transaction.collection('ai_post')
        .doc(postId)
        .update({
          commentCount: _.inc(1),
          updatedAt: now
        });

      // 3.7 提交事务
      await transaction.commit();

      // 4. 返回成功结果
      return res.status(201).json({
        success: true,
        code: 0,
        message: '评论成功',
        data: {
          commentId: addRes.id,
          createdAt: now.toISOString(),
          PetMeetID: PetMeetID // 返回PetMeetID信息
        }
      });

    } catch (txnError) {
      // 回滚事务并返回错误
      console.error('评论事务执行失败:', txnError);
      await transaction.rollback();
      
      return res.status(500).json({
        success: false,
        code: ErrorCode.DATABASE_ERROR,
        message: '添加评论失败，请重试'
      });
    }

  } catch (error) {
    console.error('添加评论异常:', error);
    return res.status(500).json({
      success: false,
      code: ErrorCode.DATABASE_ERROR,
      message: '服务器错误，请重试'
    });
  }
};

/**
 * 删除评论
 * @route DELETE /api/comments/:commentId
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<Object>} 删除结果
 */
const deleteComment = async (req, res) => {
  try {
    // 1. 确保用户已登录
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        message: '请先登录'
      });
    }

    // 2. 获取评论ID
    const { commentId } = req.params;
    if (!commentId) {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '缺少评论ID'
      });
    }

    // 3. 使用事务执行删除操作
    const transaction = await db.startTransaction();
    try {
      // 3.1 查询评论是否存在且属于当前用户
      const commentDoc = await transaction.collection('ai_comment')
        .doc(commentId)
        .get();

      if (!commentDoc.data) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          code: ErrorCode.PARAM_INVALID,
          message: '评论不存在'
        });
      }

      // 3.2 验证评论所有权
      if (commentDoc.data._openid !== userId) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          code: ErrorCode.UNAUTHORIZED,
          message: '无权删除此评论'
        });
      }

      // 3.3 获取评论所属的帖子ID
      const postId = commentDoc.data.postId;

      // 3.4 删除评论
      await transaction.collection('ai_comment')
        .doc(commentId)
        .remove();

      // 3.5 更新帖子评论数
      await transaction.collection('ai_post')
        .doc(postId)
        .update({
          commentCount: _.inc(-1),
          updatedAt: new Date()
        });

      // 3.6 提交事务
      await transaction.commit();

      // 4. 返回成功结果和更新后的评论数量
      // 获取最新的评论计数
      const updatedPostDoc = await db.collection('ai_post')
        .doc(postId)
        .field({ commentCount: true })
        .get();
      
      const updatedCommentCount = updatedPostDoc.data ? updatedPostDoc.data.commentCount : 0;

      return res.status(200).json({
        success: true,
        code: 0,
        message: '评论已删除',
        data: {
          updatedCommentCount: updatedCommentCount
        }
      });

    } catch (txnError) {
      // 回滚事务并返回错误
      console.error('删除评论事务执行失败:', txnError);
      await transaction.rollback();
      
      return res.status(500).json({
        success: false,
        code: ErrorCode.DATABASE_ERROR,
        message: '删除评论失败，请重试'
      });
    }

  } catch (error) {
    console.error('删除评论异常:', error);
    return res.status(500).json({
      success: false,
      code: ErrorCode.DATABASE_ERROR,
      message: '服务器错误，请重试'
    });
  }
};

module.exports = {
  getComments,
  addComment,
  deleteComment
};
