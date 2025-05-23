module.exports = {
  apps: [{
    name: 'petmeet-backend',
    script: 'app.js',
    cwd: '/var/www/petmeet-backend',
    instances: 'max', // 使用所有CPU核心
    exec_mode: 'cluster', // 集群模式
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // 日志配置
    out_file: '/var/www/petmeet-backend/logs/out.log',
    error_file: '/var/www/petmeet-backend/logs/error.log',
    log_file: '/var/www/petmeet-backend/logs/combined.log',
    time: true,
    // 自动重启配置
    max_memory_restart: '1G',
    watch: false, // 生产环境建议关闭文件监控
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    // 进程管理
    min_uptime: '10s',
    max_restarts: 10,
    // 优雅重启
    kill_timeout: 5000,
    listen_timeout: 3000,
    // 健康检查
    health_check_grace_period: 3000
  }],

  deploy: {
    production: {
      user: 'ubuntu', // 根据您的服务器用户调整
      host: 'YOUR_SERVER_IP', // 替换为您的服务器IP
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/petmeet-backend.git', // 替换为您的仓库地址
      path: '/var/www/petmeet-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && cp deploy/env.production.template .env.production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 