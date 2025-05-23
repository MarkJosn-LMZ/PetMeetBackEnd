const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 导入路由
const indexRoutes = require('./routes/index');
const testRoutes = require('./routes/test');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const uploadRoutes = require('./routes/upload');
const membershipRoutes = require('./routes/membership');
const postRoutes = require('./routes/post');
const storageRoutes = require('./routes/storage');
const cloudStorageRoutes = require('./routes/cloudStorage'); // 新增云存储路由
const topicRoutes = require('./routes/topic'); // 新增话题路由
const commentRoutes = require('./routes/comment');
const likeRoutes = require('./routes/like');
const favoriteRoutes = require('./routes/favorite');
const searchRoutes = require('./routes/search'); // 新增搜索路由
const petRoutes = require('./routes/pet'); // 新增宠物路由
const reminderRoutes = require('./routes/reminder'); // 新增提醒路由
const healthRoutes = require('./routes/health'); // 新增健康路由
const hospitalsRoutes = require('./routes/hospitals'); // 新增医院路由

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());

// 完全禁用请求日志
// 如果需要重新启用，可以将下一行取消注释
// app.use(morgan('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api', indexRoutes);
app.use('/test', testRoutes);
app.use('/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/membership', membershipRoutes);
// 使用两个路由前缀，确保兼容前端请求
app.use('/api/posts', postRoutes);  // 复数形式
app.use('/api/post', postRoutes);   // 单数形式，与前端请求匹配
app.use('/api/search', searchRoutes); // 搜索路由
app.use('/api/pet', petRoutes); // 宠物路由
app.use('/api', reminderRoutes); // 提醒路由
app.use('/api/storage', storageRoutes);
app.use('/api/cloud', cloudStorageRoutes); // 新增云存储路由
app.use('/api/topic', topicRoutes); // 新增话题路由
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/health', healthRoutes); // 健康相关路由
app.use('/api/hospitals', hospitalsRoutes); // 新增医院路由

// 默认路由
app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用Cloudbase后端API'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在: http://localhost:${PORT}`);
});

module.exports = app;
