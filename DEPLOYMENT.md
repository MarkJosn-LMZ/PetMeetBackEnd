# PetMeet 后端腾讯云轻量服务器部署指南

## 部署概览

本指南将帮助您将 PetMeet 后端应用部署到腾讯云轻量服务器，实现高可用、高性能的生产环境。

### 架构说明
- **Node.js + Express**: 后端应用框架
- **PM2**: 进程管理和集群模式
- **Nginx**: 反向代理和负载均衡
- **腾讯云开发**: 数据库和云存储
- **腾讯云轻量服务器**: 服务器基础设施

## 前期准备

### 1. 服务器要求
- **推荐配置**: 2核4GB内存，40GB SSD
- **操作系统**: Ubuntu 20.04/22.04 LTS
- **网络**: 公网IP，建议配置域名

### 2. 腾讯云开发环境
确保您已经配置好：
- CloudBase 环境ID
- API密钥（SecretId/SecretKey）
- 数据库集合已创建

### 3. 本地准备
- 代码已推送到Git仓库（GitHub/GitLab/码云等）
- 环境变量配置清单

## 快速部署

### 步骤1: 连接服务器
```bash
# 使用SSH连接服务器
ssh ubuntu@your_server_ip

# 或者使用腾讯云控制台的网页终端
```

### 步骤2: 运行环境配置脚本
```bash
# 下载并运行环境配置脚本
wget https://raw.githubusercontent.com/yourusername/petmeet-backend/main/deploy/server-setup.sh
chmod +x server-setup.sh
./server-setup.sh
```

### 步骤3: 克隆项目
```bash
# 克隆项目到服务器
cd /var/www
git clone https://github.com/yourusername/petmeet-backend.git
cd petmeet-backend
```

### 步骤4: 配置环境变量
```bash
# 复制环境变量模板
cp deploy/env.production.template .env.production

# 编辑环境变量
nano .env.production
```

**重要配置项**:
```env
NODE_ENV=production
PORT=3000
CLOUDBASE_ENV_ID=your_cloudbase_env_id
CLOUDBASE_SECRET_ID=your_secret_id
CLOUDBASE_SECRET_KEY=your_secret_key
JWT_SECRET=your_super_secure_jwt_secret
SERVER_HOST=your_domain_or_ip
```

### 步骤5: 运行部署脚本
```bash
# 运行一键部署脚本
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### 步骤6: 配置域名（可选）
如果您有域名，请修改Nginx配置：
```bash
sudo nano /etc/nginx/sites-available/petmeet
# 修改 server_name 为您的域名
sudo nginx -t
sudo systemctl reload nginx
```

## 手动部署步骤

如果自动化脚本失败，可以按照以下步骤手动部署：

### 1. 安装依赖
```bash
npm install --production
```

### 2. 配置Nginx
```bash
# 复制Nginx配置
sudo cp deploy/nginx-petmeet.conf /etc/nginx/sites-available/petmeet
sudo ln -s /etc/nginx/sites-available/petmeet /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 启动应用
```bash
# 使用PM2启动应用
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 腾讯云控制台配置

### 1. 防火墙配置
在腾讯云轻量应用服务器控制台中配置防火墙：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 0.0.0.0/0 | SSH连接 |
| TCP | 80 | 0.0.0.0/0 | HTTP |
| TCP | 443 | 0.0.0.0/0 | HTTPS |
| TCP | 3000 | 127.0.0.1/32 | Node.js（仅本地） |

### 2. 域名解析（可选）
如果使用域名：
1. 在DNS提供商处添加A记录
2. 记录值指向服务器公网IP

## 验证部署

### 1. 健康检查
```bash
# 检查应用状态
curl http://localhost:3000/health

# 检查API接口
curl http://localhost:3000/api

# 通过Nginx访问
curl http://your_server_ip/health
```

### 2. 查看日志
```bash
# PM2日志
pm2 logs petmeet-backend

# Nginx日志
sudo tail -f /var/log/nginx/petmeet_access.log
sudo tail -f /var/log/nginx/petmeet_error.log

# 应用日志
tail -f /var/www/petmeet-backend/logs/error.log
```

### 3. 监控指标
```bash
# 进程状态
pm2 status
pm2 monit

# 系统资源
htop
df -h
```

## 常用运维命令

### 应用管理
```bash
# 重启应用
pm2 restart petmeet-backend

# 停止应用
pm2 stop petmeet-backend

# 查看实时日志
pm2 logs petmeet-backend --lines 100

# 重载配置
pm2 reload petmeet-backend
```

### 代码更新
```bash
cd /var/www/petmeet-backend
git pull origin main
npm install --production
pm2 restart petmeet-backend
```

### Nginx管理
```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx

# 重启Nginx
sudo systemctl restart nginx
```

## 性能优化

### 1. PM2集群模式
已在`ecosystem.config.js`中配置集群模式，自动使用所有CPU核心。

### 2. Nginx缓存
静态文件已配置30天缓存，上传文件通过Nginx直接服务。

### 3. 数据库优化
- 合理设计CloudBase数据库索引
- 使用分页查询避免大量数据传输
- 实施缓存策略

## 安全建议

### 1. 环境变量安全
- 使用强JWT密钥
- 定期轮换API密钥
- 限制CORS来源域名

### 2. 服务器安全
```bash
# 更新系统
sudo apt update && sudo apt upgrade

# 配置fail2ban防止暴力破解
sudo apt install fail2ban

# 禁用root登录
sudo nano /etc/ssh/sshd_config
# 设置 PermitRootLogin no
```

### 3. 备份策略
```bash
# 创建备份脚本
cat > /home/ubuntu/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /home/ubuntu/backup_${DATE}.tar.gz /var/www/petmeet-backend --exclude=node_modules
# 可以上传到腾讯云COS
EOF

# 设置定时备份
crontab -e
# 添加: 0 2 * * * /home/ubuntu/backup.sh
```

## SSL证书配置（推荐）

### 使用Let's Encrypt免费证书
```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your_domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 故障排除

### 常见问题

#### 1. 应用无法启动
```bash
# 检查环境变量
cat .env.production

# 检查依赖安装
npm list --depth=0

# 查看详细错误
pm2 logs petmeet-backend --err
```

#### 2. Nginx 502错误
```bash
# 检查应用是否运行
pm2 status

# 检查端口占用
netstat -tlnp | grep 3000

# 检查Nginx配置
sudo nginx -t
```

#### 3. 数据库连接失败
```bash
# 检查CloudBase配置
# 验证网络连接
curl -I https://tcb-api.tencentcloudapi.com/
```

#### 4. 文件上传失败
```bash
# 检查上传目录权限
ls -la /var/www/petmeet-backend/uploads
sudo chown -R ubuntu:ubuntu /var/www/petmeet-backend/uploads
sudo chmod -R 755 /var/www/petmeet-backend/uploads
```

### 日志分析
```bash
# 应用错误日志
tail -f /var/www/petmeet-backend/logs/error.log

# Nginx访问日志
sudo tail -f /var/log/nginx/petmeet_access.log | grep -v "GET /health"

# 系统日志
sudo journalctl -f -u nginx
```

## 监控和告警

### 1. 基础监控
```bash
# CPU和内存使用率
top
htop

# 磁盘使用情况
df -h
du -sh /var/www/petmeet-backend/*

# 网络连接
netstat -an | grep :80
```

### 2. 应用监控
推荐使用腾讯云监控服务或第三方工具如：
- PM2 Plus
- New Relic
- 阿里云ARMS

## 联系支持

如果在部署过程中遇到问题，可以：

1. 查看本文档的故障排除部分
2. 检查项目GitHub Issues
3. 联系技术支持团队

---

**部署成功后，您的PetMeet后端将在腾讯云轻量服务器上稳定运行！** 🎉 