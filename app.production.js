const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// 加载环境变量
dotenv.config({ path: '.env.production' });

// 导入路由
const indexRoutes = require('./routes/index');
const testRoutes = require('./routes/test');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const uploadRoutes = require('./routes/upload');
const membershipRoutes = require('./routes/membership');
const postRoutes = require('./routes/post');
const storageRoutes = require('./routes/storage');
const cloudStorageRoutes = require('./routes/cloudStorage');
const topicRoutes = require('./routes/topic');
const commentRoutes = require('./routes/comment');
const likeRoutes = require('./routes/like');
const favoriteRoutes = require('./routes/favorite');
const searchRoutes = require('./routes/search');
const petRoutes = require('./routes/pet');
const reminderRoutes = require('./routes/reminder');
const healthRoutes = require('./routes/health');
const hospitalsRoutes = require('./routes/hospitals');

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 安全性中间件配置
app.disable('x-powered-by'); // 隐藏Express信息

// CORS配置 - 生产环境应该限制来源
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// 生产环境日志配置
if (process.env.NODE_ENV === 'production') {
  // 确保日志目录存在
  const logDir = process.env.LOG_DIR || '/var/www/petmeet-backend/logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // 访问日志
  const accessLogStream = fs.createWriteStream(path.join(logDir, 'access.log'), { flags: 'a' });
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// 请求体解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务配置
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir, {
  maxAge: '30d', // 缓存30天
  etag: true,
  lastModified: true
}));

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// API路由
app.use('/api', indexRoutes);
app.use('/test', testRoutes);
app.use('/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/post', postRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/pet', petRoutes);
app.use('/api', reminderRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/cloud', cloudStorageRoutes);
app.use('/api/topic', topicRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/hospitals', hospitalsRoutes);

// 默认路由
app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用PetMeet后端API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.originalUrl
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  // 记录错误日志
  const timestamp = new Date().toISOString();
  const errorLog = `[${timestamp}] ${err.stack}\n`;
  
  if (process.env.NODE_ENV === 'production') {
    const logDir = process.env.LOG_DIR || '/var/www/petmeet-backend/logs';
    fs.appendFile(path.join(logDir, 'error.log'), errorLog, (writeErr) => {
      if (writeErr) console.error('写入错误日志失败:', writeErr);
    });
  } else {
    console.error(err.stack);
  }
  
  // 返回错误响应
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? '服务器内部错误' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: timestamp
  });
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  server.close(() => {
    console.log('HTTP服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  server.close(() => {
    console.log('HTTP服务器已关闭');
    process.exit(0);
  });
});

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PetMeet后端服务器启动成功`);
  console.log(`环境: ${process.env.NODE_ENV}`);
  console.log(`端口: ${PORT}`);
  console.log(`时间: ${new Date().toISOString()}`);
});

module.exports = app; 