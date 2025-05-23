const { getDatabase } = require('../config/cloudbaseConfig');
const db = getDatabase();
const _ = db.command;

// 错误码定义
const ErrorCode = {
  PARAM_INVALID: 5001,    // 输入参数无效
  POST_NOT_FOUND: 5002,   // 帖子不存在或不可点赞 (如非 approved 状态)
  TRANSACTION_ERROR: 5003,// 事务执行失败 (包括冲突)
  DATABASE_ERROR: 5004,   // 其他数据库错误
  UNAUTHORIZED: 5005      // 用户未登录
};

/**
 * 切换帖子的点赞状态
 * 根据当前状态执行点赞或取消点赞操作
 */
const toggleLike = async (req, res) => {
  try {
    // 1. 获取当前用户ID和PetMeetID
    const currentUserOpenid = req.user?.userId;
    const currentUserPetMeetID = req.user?.PetMeetID;
    if (!currentUserOpenid) {
      return res.status(401).json({
        success: false,
        code: ErrorCode.UNAUTHORIZED,
        message: '无法获取用户信息，请检查登录状态'
      });
    }

    // 2. 获取并校验输入参数
    const { postId } = req.body;
    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({
        success: false,
        code: ErrorCode.PARAM_INVALID,
        message: '参数无效 (postId)'
      });
    }

    console.log(`用户 ${currentUserOpenid} (PetMeetID: ${currentUserPetMeetID || '无'}) 尝试切换帖子 ${postId} 的点赞状态`);

    // 3. 使用数据库事务保证原子性
    const transaction = await db.startTransaction();
    
    try {
      // 4. 在事务中检查帖子是否存在且状态允许点赞，并获取当前点赞数
      const postRes = await transaction.collection('ai_post').doc(postId)
        .field({ status: true, likeCount: true }) // 同时获取 likeCount
        .get();

      if (!postRes.data) {
        await transaction.rollback(-100); // 回滚事务
        console.log(`帖子 ${postId} 不存在`);
        return res.status(404).json({
          success: false,
          code: ErrorCode.POST_NOT_FOUND,
          message: '帖子不存在'
        });
      }
      
      if (postRes.data.status !== 'approved') {
        await transaction.rollback(-101); // 回滚事务
        console.log(`帖子 ${postId} 状态非 approved`);
        return res.status(403).json({
          success: false,
          code: ErrorCode.POST_NOT_FOUND,
          message: '帖子暂不可操作'
        });
      }
      
      const currentLikeCount = postRes.data.likeCount || 0; // 获取当前的 likeCount

      // 5. 查询用户当前点赞状态
      // 优先使用PetMeetID查询，如果没有再用openid查询
      let likeQuery = {};
      
      if (currentUserPetMeetID) {
        // 如果有PetMeetID，优先使用
        likeQuery = {
          PetMeetID: currentUserPetMeetID,
          postId: postId
        };
      } else {
        // 如果没有PetMeetID，使用openid
        likeQuery = {
          _openid: currentUserOpenid,
          postId: postId
        };
      }
      
      const likeRes = await transaction.collection('ai_like')
        .where(likeQuery)
        .get();

      let isLiked = false;        // 标记操作完成后的状态
      let likeCountChange = 0;    // 记录点赞数变化
      let finalLikeCount = currentLikeCount; // 初始化最终点赞数

      if (likeRes.data.length > 0) {
        // 已点赞，执行取消点赞操作
        console.log(`用户 ${currentUserOpenid} 已点赞帖子 ${postId}，执行取消点赞`);
        const likeIdToDelete = likeRes.data[0]._id;

        // 在事务中删除点赞记录
        try {
          await transaction.collection('ai_like').doc(likeIdToDelete).remove();
          console.log(`已成功删除点赞记录 ID: ${likeIdToDelete}`);
          likeCountChange = -1; // 点赞数减 1
        } catch (removeError) {
          console.error(`删除点赞记录失败:`, removeError);
          // 不改变点赞数
        }
        
        isLiked = false; // 操作后变为未点赞
      } else {
        // 未点赞，执行点赞操作
        console.log(`用户 ${currentUserOpenid} 未点赞帖子 ${postId}，执行点赞`);

        // 6.1 创建新的点赞记录
        const newLike = {
          _openid: currentUserOpenid,
          PetMeetID: currentUserPetMeetID, // 添加PetMeetID
          postId: postId,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        };

        // 在事务中添加点赞记录
        await transaction.collection('ai_like').add(newLike);
        
        likeCountChange = 1; // 点赞数加 1
        isLiked = true; // 操作后变为已点赞
      }

      // 6. 在事务中原子更新 ai_post 的 likeCount (仅当点赞状态实际改变时)
      if (likeCountChange !== 0) {
        try {
          await transaction.collection('ai_post').doc(postId).update({
            likeCount: _.inc(likeCountChange),
            updatedAt: db.serverDate() // 同时更新帖子的更新时间
          });
          
          finalLikeCount = currentLikeCount + likeCountChange; // 更新成功
          console.log(`帖子 ${postId} 的 likeCount 变化: ${likeCountChange}, 更新后为 ${finalLikeCount}`);
        } catch (updateError) {
          console.error(`更新帖子点赞数失败:`, updateError);
          finalLikeCount = currentLikeCount; // 如果更新失败，保持原点赞数
        }
      }

      // 7. 提交事务
      await transaction.commit();
      console.log('点赞事务提交成功');

      // 8. 返回成功结果
      return res.status(200).json({
        success: true,
        data: {
          isLiked: isLiked,       // 返回操作后的最终点赞状态
          likeCount: finalLikeCount // 返回最终的点赞数
        },
        message: isLiked ? '点赞成功' : '取消点赞成功'
      });

    } catch (transactionError) {
      // 捕获事务执行过程中的任何错误
      await transaction.rollback(); // 发生错误，必须回滚事务
      console.error('toggleLike 事务执行失败，已回滚:', transactionError);

      let errorCode = ErrorCode.TRANSACTION_ERROR; // 默认事务错误
      let errorMessage = '操作失败，请稍后重试';

      // 尝试识别更具体的错误
      if (transactionError.errCode) { // 如果错误对象本身带了 errCode
        errorCode = transactionError.errCode;
        if (transactionError.errCode === -502005 || transactionError.errMsg?.includes('Transaction conflict')) {
          errorMessage = '操作频繁，请稍后再试';
          errorCode = ErrorCode.TRANSACTION_ERROR; // 归类为事务错误
        } else if (errorCode === ErrorCode.POST_NOT_FOUND) {
          errorMessage = '帖子不存在或暂不可操作';
        }
      } else if (transactionError.message?.includes('no matching document')) {
        errorCode = ErrorCode.POST_NOT_FOUND; // 可能帖子或点赞记录在事务过程中被删除
        errorMessage = '目标不存在，请刷新重试';
      }

      return res.status(500).json({
        success: false,
        code: errorCode,
        message: errorMessage
      });
    }
  } catch (error) {
    console.error('处理点赞请求时出错:', error);
    return res.status(500).json({
      success: false,
      code: ErrorCode.DATABASE_ERROR,
      message: '服务器错误'
    });
  }
};

/**
 * 检查用户是否点赞了指定帖子
 */
const checkLikeStatus = async (req, res) => {
  try {
    // 1. 获取当前用户ID
    const currentUserOpenid = req.user?.userId;
    if (!currentUserOpenid) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }

    // 2. 获取帖子ID
    const { postId } = req.params;
    if (!postId) {
      return res.status(400).json({
        success: false,
        message: '缺少帖子ID'
      });
    }

    // 3. 查询点赞记录
    const { data } = await db.collection('ai_like').where({
      postId: postId,
      _openid: currentUserOpenid
    }).limit(1).get();

    // 4. 查询帖子当前点赞数
    const postRes = await db.collection('ai_post').doc(postId)
      .field({ likeCount: true })
      .get();
    
    const likeCount = (postRes.data && postRes.data.likeCount) || 0;

    // 5. 返回点赞状态和点赞数
    return res.status(200).json({
      success: true,
      data: {
        isLiked: data && data.length > 0,
        likeCount: likeCount
      }
    });

  } catch (error) {
    console.error('检查点赞状态时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

module.exports = {
  toggleLike,
  checkLikeStatus
};
