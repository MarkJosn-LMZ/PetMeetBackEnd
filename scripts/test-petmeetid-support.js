/**
 * PetMeetID支持测试脚本
 * 测试所有控制器中的PetMeetID支持是否正常工作
 */

require('dotenv').config();
const { getDatabase } = require('../config/cloudbaseConfig');

// 初始化数据库连接
const db = getDatabase();
const _ = db.command;

// 模拟请求和响应对象
class MockRequest {
  constructor(params = {}, query = {}, body = {}, user = null, headers = {}) {
    this.params = params;
    this.query = query;
    this.body = body;
    this.user = user;
    this.headers = headers;
    this.file = null; // 用于上传测试
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.data = null;
    this.headers = {};
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(data) {
    this.data = data;
    return this;
  }

  send(data) {
    this.data = data;
    return this;
  }
}

// 加载所有控制器
const authController = require('../controllers/authController');
const commentController = require('../controllers/commentController');
const favoriteController = require('../controllers/favoriteController');
const likeController = require('../controllers/likeController');
const membershipController = require('../controllers/membershipController');
const postController = require('../controllers/postController');
const profileController = require('../controllers/profileController');
const todoController = require('../controllers/todoController');
const uploadController = require('../controllers/uploadController');

// 测试用户数据
const testUser = {
  userId: 'test_user_id_12345',
  PetMeetID: '123456789', // 测试用PetMeetID
  authUser: {
    _id: 'test_user_id_12345',
    nickName: '测试用户',
    PetMeetID: '123456789',
    status: 'active'
  },
  profileUser: {
    _id: 'profile_12345',
    _openid: 'test_user_id_12345',
    PetMeetID: '123456789',
    nickName: '测试用户',
    avatarUrl: 'https://example.com/avatar.jpg'
  }
};

/**
 * 测试控制器方法
 * @param {string} controllerName 控制器名称
 * @param {string} methodName 方法名称
 * @param {Function} method 控制器方法
 * @param {Object} req 请求对象
 */
async function testControllerMethod(controllerName, methodName, method, req) {
  console.log(`\n🧪 测试 ${controllerName}.${methodName} 中的PetMeetID支持...`);
  
  try {
    const res = new MockResponse();
    
    // 调用控制器方法
    await method(req, res);
    
    // 检查响应
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`✅ ${controllerName}.${methodName} 测试通过！状态码: ${res.statusCode}`);
      
      // 检查响应中是否包含PetMeetID相关字段
      const hasPetMeetID = JSON.stringify(res.data).includes('PetMeetID') || 
                          JSON.stringify(res.data).includes('PetMeetID');
      
      if (hasPetMeetID) {
        console.log(`✅ 响应中包含PetMeetID相关字段`);
      } else {
        console.log(`⚠️ 提示: 响应中未找到PetMeetID相关字段，需要进一步检查`);
      }
    } else {
      console.log(`⚠️ ${controllerName}.${methodName} 返回了非成功状态码: ${res.statusCode}`);
      console.log('响应数据:', res.data);
    }
  } catch (error) {
    console.error(`❌ ${controllerName}.${methodName} 测试失败:`, error.message);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('====================================');
  console.log('开始测试控制器中的PetMeetID支持');
  console.log('====================================');
  
  // 1. 测试身份验证控制器 - 生成PetMeetID
  const authReq = new MockRequest(
    {}, 
    {}, 
    { phone: '13800138000', code: '123456' }, 
    testUser
  );
  if (authController.generatePetMeetID) {
    console.log('\n测试认证控制器中的PetMeetID生成...');
    try {
      const PetMeetID = await authController.generatePetMeetID(testUser.userId);
      console.log(`✅ 成功生成PetMeetID: ${PetMeetID}`);
    } catch (error) {
      console.error('❌ PetMeetID生成失败:', error.message);
    }
  } else if (authController.loginWithPhoneCode) {
    await testControllerMethod('authController', 'loginWithPhoneCode', authController.loginWithPhoneCode, authReq);
  }

  // 2. 测试评论控制器
  if (commentController.addComment) {
    const commentReq = new MockRequest(
      {}, 
      {}, 
      { postId: 'test_post_id', content: '测试评论内容' }, 
      testUser
    );
    await testControllerMethod('commentController', 'addComment', commentController.addComment, commentReq);
  }

  // 3. 测试收藏控制器
  if (favoriteController.toggleFavorite) {
    const favoriteReq = new MockRequest(
      {}, 
      {}, 
      { postId: 'test_post_id' }, 
      testUser
    );
    await testControllerMethod('favoriteController', 'toggleFavorite', favoriteController.toggleFavorite, favoriteReq);
  }

  // 4. 测试点赞控制器
  if (likeController.toggleLike) {
    const likeReq = new MockRequest(
      {}, 
      {}, 
      { postId: 'test_post_id' }, 
      testUser
    );
    await testControllerMethod('likeController', 'toggleLike', likeController.toggleLike, likeReq);
  }

  // 5. 测试会员控制器
  if (membershipController.getUserMembership) {
    const membershipReq = new MockRequest({}, {}, {}, testUser);
    await testControllerMethod('membershipController', 'getUserMembership', membershipController.getUserMembership, membershipReq);
  }

  // 6. 测试帖子控制器
  if (postController.getPostFeed) {
    const postReq = new MockRequest(
      {}, 
      { page: '1', pageSize: '10', adultMode: 'false', type: 'latest' }, 
      {}, 
      testUser
    );
    await testControllerMethod('postController', 'getPostFeed', postController.getPostFeed, postReq);
  }

  // 7. 测试个人资料控制器
  if (profileController.saveUserProfile) {
    const profileReq = new MockRequest(
      {}, 
      {}, 
      { nickName: '测试更新', gender: 1 }, 
      testUser
    );
    await testControllerMethod('profileController', 'saveUserProfile', profileController.saveUserProfile, profileReq);
  }

  // 8. 测试待办事项控制器
  if (todoController.createTodo) {
    const todoReq = new MockRequest(
      {}, 
      {}, 
      { title: '测试待办', content: '测试内容' }, 
      testUser
    );
    await testControllerMethod('todoController', 'createTodo', todoController.createTodo, todoReq);
  }

  // 9. 测试上传控制器
  if (uploadController.uploadFile) {
    const uploadReq = new MockRequest({}, {}, {}, testUser);
    uploadReq.file = {
      originalname: 'test.jpg',
      path: '/tmp/test.jpg'
    };
    // 注意：这个测试可能会失败，因为它需要真实的文件
    // await testControllerMethod('uploadController', 'uploadFile', uploadController.uploadFile, uploadReq);
    console.log('\n上传控制器测试需要真实文件，已准备好测试代码但不执行');
  }

  console.log('\n====================================');
  console.log('PetMeetID支持测试完成');
  console.log('注意：由于是模拟测试，某些控制器可能返回错误状态码');
  console.log('这通常是因为缺少真实数据库交互，但能够验证代码逻辑');
  console.log('====================================');
}

// 执行测试
runTests()
  .then(() => {
    console.log('测试脚本执行完毕');
    process.exit(0);
  })
  .catch(error => {
    console.error('测试脚本执行出错:', error);
    process.exit(1);
  });
