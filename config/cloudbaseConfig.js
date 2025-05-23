const tcb = require('@cloudbase/node-sdk');

/**
 * 初始化云开发CloudBase
 * 使用前请先在.env文件中配置环境变量：
 * CLOUDBASE_ENV_ID：环境ID
 * CLOUDBASE_SECRET_ID：密钥ID (可选，云函数环境下可不填)
 * CLOUDBASE_SECRET_KEY：密钥Key (可选，云函数环境下可不填)
 */
const initCloudBase = () => {
  // 在云函数环境下，可以不传入密钥
  if (process.env.CLOUDBASE_ENV_ID && process.env.CLOUDBASE_SECRET_ID && process.env.CLOUDBASE_SECRET_KEY) {
    return tcb.init({
      env: process.env.CLOUDBASE_ENV_ID,
      secretId: process.env.CLOUDBASE_SECRET_ID,
      secretKey: process.env.CLOUDBASE_SECRET_KEY,
    });
  } else if (process.env.CLOUDBASE_ENV_ID) {
    // 仅使用环境ID初始化(适用于云函数环境)
    return tcb.init({
      env: process.env.CLOUDBASE_ENV_ID
    });
  } else {
    // 使用默认值，用于开发环境
    console.warn('警告: 未设置CLOUDBASE_ENV_ID环境变量，使用默认值。仅用于开发测试！');
    return tcb.init({
      env: 'cloud1-9g9n1il77a00ffbc' // 使用默认环境ID
    });
  }
};

// 获取数据库实例
const getDatabase = () => {
  const app = initCloudBase();
  return app.database();
};

/**
 * 获取 CloudBase 实例
 * @returns {tcb.CloudBase} CloudBase 实例
 */
const getCloudBase = () => {
  return initCloudBase();
};

// 导出所有函数
module.exports = {
  initCloudBase,
  getDatabase,
  getCloudBase
};
