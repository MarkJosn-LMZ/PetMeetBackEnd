const { getDatabase } = require('../config/cloudbaseConfig');

const db = getDatabase();
const _ = db.command;

/**
 * 搜索帖子
 * @route GET /api/search/posts
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @returns {Promise<void>}
 */
async function searchPosts(req, res) {
  const { keyword, adultModeEnabled = false, page = 1, pageSize = 20 } = req.query;

  if (!keyword || keyword.trim() === '') {
    return res.status(400).json({
      success: false,
      message: '搜索关键词不能为空',
      data: []
    });
  }

  try {
    console.log(`执行搜索: 关键词="${keyword}", 成人模式=${adultModeEnabled}`);

    // 构建搜索条件
    const keywordRegExp = new RegExp(keyword, 'i'); // 不区分大小写

    // ======== 搜索帖文 ========
    // 基础查询条件
    let postQuery = {
      _openid: { $exists: true }, // 确保帖子有发布者
      // 在标题或内容中搜索关键词
      $or: [
        { title: keywordRegExp },
        { content: keywordRegExp }
      ],
      status: 'approved' // 只搜索已审核的帖子
    };

    // 成人模式筛选
    if (adultModeEnabled !== 'true') {
      // 非成人模式下只显示 standard 内容，不显示 adult 内容
      postQuery.contentType = 'standard';
    }

    // ======== 搜索用户昵称 ========
    // 先查询匹配昵称的用户
    const userQueryRegex = {
      nickName: keywordRegExp
    };

    // 查询匹配昵称的用户
    let userResults;
    try {
      userResults = await db.collection('user_profile')
        .where(userQueryRegex)
        .get();
      
      console.log(`搜索结果: 找到${userResults.data.length}个用户`);
    } catch (err) {
      console.error('搜索用户出错:', err);
      userResults = { data: [] };
    }

    // 提取符合条件的用户OpenID列表
    const matchedUserOpenids = userResults.data.map(user => user._openid);

    console.log(`昵称匹配用户数: ${matchedUserOpenids.length}`);

    // 如果有匹配昵称的用户，将他们的帖子加入到搜索条件中
    if (matchedUserOpenids.length > 0) {
      console.log('开始查询用户发帖...');
      
      // 查询用户发帖
      const userPostsQuery = {
        _openid: { $in: matchedUserOpenids },
        status: 'approved'
      };
      
      // 添加成人模式筛选
      if (adultModeEnabled !== 'true') {
        userPostsQuery.contentType = 'standard';
      }
      
      // 先查询用户帖文数量
      const userPostsCount = await db.collection('ai_post')
        .where(userPostsQuery)
        .count();
        
      const userPostsTotal = userPostsCount.total;
      console.log(`用户帖文总数: ${userPostsTotal}`);
      
      // 查询用户帖文
      const userPostsResult = await db.collection('ai_post')
        .where(userPostsQuery)
        .orderBy('updatedAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(parseInt(pageSize))
        .get();
      
      console.log(`用户帖文查询结果: ${userPostsResult.data.length}条`);
      
      // 同时查询内容和标题匹配的帖文
      let contentResults = { data: [] };
      let contentTotal = 0;
      
      // 构建内容和标题匹配的查询条件
      if (keyword && keyword.trim() !== '') {
        const contentQuery = {
          $or: [
            { title: keywordRegExp },
            { content: keywordRegExp }
          ],
          status: 'approved'
        };
        
        if (adultModeEnabled !== 'true') {
          contentQuery.contentType = 'standard';
        }
        
        // 查询内容匹配的帖文数量
        const contentCountResult = await db.collection('ai_post')
          .where(contentQuery)
          .count();
        contentTotal = contentCountResult.total;
        
        // 查询内容匹配的帖文
        contentResults = await db.collection('ai_post')
          .where(contentQuery)
          .orderBy('updatedAt', 'desc')
          .skip((page - 1) * pageSize)
          .limit(parseInt(pageSize))
          .get();
          
        console.log(`内容匹配查询结果: ${contentResults.data.length}条`);
      }
      
      // 合并两种查询结果，去重
      const allPosts = [];
      const seenIds = new Set();
      
      // 先添加用户帖文
      userPostsResult.data.forEach(post => {
        if (!seenIds.has(post._id)) {
          allPosts.push(post);
          seenIds.add(post._id);
        }
      });
      
      // 再添加内容匹配的帖文（去重）
      contentResults.data.forEach(post => {
        if (!seenIds.has(post._id)) {
          allPosts.push(post);
          seenIds.add(post._id);
        }
      });
      
      // 计算合并后的总数
      const total = userPostsTotal + contentTotal - (userPostsTotal + contentTotal - allPosts.length);
      console.log(`合并后总数: ${total}, 实际条数: ${allPosts.length}`);
      
      // 如果有查询结果
      if (allPosts.length > 0) {
        // 获取所有发帖用户的用户信息
        const uniqueOpenids = [...new Set(allPosts.map(post => post._openid))];
        const usersResult = await db.collection('user_profile')
          .where({
            _openid: { $in: uniqueOpenids }
          })
          .get();
        
        // 创建用户信息映射表
        const userMap = {};
        usersResult.data.forEach(user => {
          userMap[user._openid] = user;
        });
        
        // 格式化搜索结果，为每个结果添加匹配高亮信息
        const formattedResults = allPosts.map(post => {
          const postAuthor = userMap[post._openid] || {};
          const isUserMatch = matchedUserOpenids.includes(post._openid);
          
          // 在返回结果中添加匹配信息
          let matchInfo = {
            isMatchTitle: post.title && post.title.search(keywordRegExp) !== -1,
            isMatchContent: post.content && post.content.search(keywordRegExp) !== -1,
            isMatchAuthor: isUserMatch,
            authorNickName: postAuthor.nickName || '未知用户'
          };
          
          return {
            ...post,
            authorNickName: postAuthor.nickName || '未知用户',
            authorAvatarUrl: postAuthor.avatarUrl || '',
            matchInfo
          };
        });
        
        // 获取匹配的用户信息
        const matchedUsersDetails = await db.collection('user_profile')
          .where({
            _openid: { $in: matchedUserOpenids }
          })
          .get();
        
        // 返回带用户信息的搜索结果
        return res.json({
          success: true,
          data: formattedResults,
          users: matchedUsersDetails.data, // 添加匹配的用户列表
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          hasMore: total > page * pageSize,
          hasUserMatches: true
        });
      } else {
        // 如果没有找到帖子但找到了用户
        const matchedUsersDetails = await db.collection('user_profile')
          .where({
            _openid: { $in: matchedUserOpenids }
          })
          .get();
        
        console.log(`没有帖子但匹配到${matchedUsersDetails.data.length}个用户`);
        
        return res.json({
          success: true,
          data: [],
          users: matchedUsersDetails.data,
          total: 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          hasMore: false,
          hasUserMatches: true
        });
      }
    } else {
      // 如果没有匹配昵称的用户，只执行帖文内容和标题的搜索
      const countResult = await db.collection('ai_post').where(postQuery).count();
      const total = countResult.total;

      // 获取搜索结果并按更新时间排序
      const searchResults = await db.collection('ai_post')
        .where(postQuery)
        .orderBy('updatedAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(parseInt(pageSize))
        .get();

      console.log(`仅帖文搜索结果: 共找到 ${total} 条匹配记录`);

      // 获取所有发帖用户的用户信息
      const uniqueOpenids = [...new Set(searchResults.data.map(post => post._openid))];
      const usersResult = await db.collection('user_profile')
        .where({
          _openid: { $in: uniqueOpenids }
        })
        .get();

      // 创建用户信息映射表
      const userMap = {};
      usersResult.data.forEach(user => {
        userMap[user._openid] = user;
      });

      // 格式化搜索结果，为每个结果添加匹配高亮信息
      const formattedResults = searchResults.data.map(post => {
        const postAuthor = userMap[post._openid] || {};

        // 在返回结果中添加匹配信息，用于前端高亮显示
        let matchInfo = {
          isMatchTitle: post.title && post.title.search(keywordRegExp) !== -1,
          isMatchContent: post.content && post.content.search(keywordRegExp) !== -1,
          isMatchAuthor: false,
          authorNickName: postAuthor.nickName || '未知用户'
        };

        return {
          ...post,
          authorNickName: postAuthor.nickName || '未知用户',
          authorAvatarUrl: postAuthor.avatarUrl || '',
          matchInfo
        };
      });

      return res.json({
        success: true,
        data: formattedResults,
        users: [],
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        hasMore: total > page * pageSize,
        hasUserMatches: false
      });
    }
  } catch (error) {
    console.error('搜索帖子时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}

module.exports = {
  searchPosts
};
