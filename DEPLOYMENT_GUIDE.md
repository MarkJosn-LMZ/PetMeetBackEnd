# PetMeet 腾讯云服务器部署指南

这是一个完整的指南，将帮助你从零开始在腾讯云服务器上部署PetMeet后端和管理面板。

## 📋 准备工作

### 1. 服务器要求
- **系统**: CentOS 7+ 或 Ubuntu 18.04+
- **配置**: 最低2核4GB内存，推荐4核8GB
- **存储**: 最少40GB SSD
- **网络**: 公网IP，带宽建议5Mbps+

### 2. 域名配置（可选但推荐）
- 注册域名并添加A记录指向服务器IP
- 如果没有域名，可以直接使用IP地址访问

### 3. 腾讯云服务准备
- 开通CloudBase云开发服务
- 获取以下信息：
  - `CLOUDBASE_ENV_ID`
  - `CLOUDBASE_SECRET_ID`
  - `CLOUDBASE_SECRET_KEY`

## 🚀 一键部署

### 步骤1: 连接到服务器

```bash
# 使用SSH连接到你的腾讯云服务器
ssh root@your-server-ip

# 创建普通用户（推荐）
adduser petmeet
usermod -aG sudo petmeet
su - petmeet
```

### 步骤2: 下载代码

```bash
# 如果使用Git（推荐）
git clone https://github.com/your-username/petmeet-backend.git
cd petmeet-backend

# 或者上传代码文件到服务器
# scp -r ./petmeet-backend petmeet@your-server-ip:~/
```

### 步骤3: 运行部署脚本

```bash
# 赋予执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

部署脚本将自动完成：
- ✅ 安装Node.js 18.x
- ✅ 安装PM2进程管理器
- ✅ 安装Nginx反向代理
- ✅ 创建项目目录结构
- ✅ 部署后端和管理面板代码
- ✅ 配置环境变量模板
- ✅ 配置PM2和Nginx
- ✅ 设置防火墙规则
- ✅ 优化系统性能
- ✅ 启动所有服务

### 步骤4: 配置环境变量

部署完成后，需要配置实际的环境变量：

```bash
# 编辑后端环境变量
sudo nano /opt/petmeet/backend/.env

# 编辑管理面板环境变量
sudo nano /opt/petmeet/admin-panel/.env
```

**必填配置项**：
```env
# 腾讯云CloudBase配置
CLOUDBASE_ENV_ID=your-actual-env-id
CLOUDBASE_SECRET_ID=your-actual-secret-id
CLOUDBASE_SECRET_KEY=your-actual-secret-key

# JWT密钥（生成强密钥）
JWT_SECRET=your-strong-random-jwt-secret
```

**生成JWT密钥**：
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 步骤5: 重启服务

```bash
# 重启所有服务以应用新配置
/opt/petmeet/restart.sh
```

### 步骤6: 验证部署

```bash
# 检查服务状态
/opt/petmeet/status.sh

# 检查日志
/opt/petmeet/logs.sh backend
/opt/petmeet/logs.sh admin
```

## 🔒 配置HTTPS（推荐）

如果你有域名，强烈建议配置HTTPS：

```bash
# 赋予执行权限
chmod +x setup-ssl.sh

# 运行SSL配置脚本
./setup-ssl.sh your-domain.com
```

## 📊 访问应用

部署完成后，你可以通过以下地址访问：

### HTTP访问（基础）
- **后端API**: `http://your-server-ip/api/`
- **管理面板**: `http://your-server-ip/admin/`
- **文件上传**: `http://your-server-ip/uploads/`

### HTTPS访问（推荐）
- **后端API**: `https://your-domain.com/api/`
- **管理面板**: `https://your-domain.com/admin/`
- **文件上传**: `https://your-domain.com/uploads/`

## 🛠️ 日常管理命令

部署后可以使用以下命令管理服务：

```bash
# 启动服务
/opt/petmeet/start.sh

# 停止服务
/opt/petmeet/stop.sh

# 重启服务
/opt/petmeet/restart.sh

# 查看状态
/opt/petmeet/status.sh

# 查看日志
/opt/petmeet/logs.sh backend   # 后端日志
/opt/petmeet/logs.sh admin     # 管理面板日志
/opt/petmeet/logs.sh nginx     # Nginx日志

# 备份数据
/opt/petmeet/backup.sh
```

## 📱 管理面板使用

### 1. 首次登录
1. 访问管理面板地址
2. 使用PetMeet ID登录
3. 可选填写昵称

### 2. 主要功能
- **用户管理**: 查看、添加、编辑、删除用户
- **帖文管理**: 管理社区帖子内容
- **AI模型管理**: 配置和管理AI模型
- **AI生成工具**: 批量生成用户和帖文
- **数据统计**: 查看系统运行数据

## 🔧 高级配置

### 性能优化

```bash
# 根据服务器配置调整PM2实例数
sudo nano /opt/petmeet/ecosystem.config.js

# 调整instances数量（通常设置为CPU核心数）
instances: 4  # 4核CPU建议设置为4
```

### Nginx优化

```bash
# 编辑Nginx配置
sudo nano /etc/nginx/sites-available/petmeet

# 常用优化选项：
- client_max_body_size: 调整文件上传大小限制
- worker_connections: 调整并发连接数
- gzip: 启用压缩减少带宽使用
```

### 监控设置

```bash
# 查看系统资源使用
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
netstat -tlnp
```

## 🚨 故障排除

### 常见问题

#### 1. 服务启动失败
```bash
# 检查端口占用
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :3001

# 检查PM2进程
pm2 status
pm2 logs

# 检查环境变量
cat /opt/petmeet/backend/.env
```

#### 2. Nginx配置错误
```bash
# 测试Nginx配置
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# 重载配置
sudo systemctl reload nginx
```

#### 3. 数据库连接失败
```bash
# 检查CloudBase配置
# 确保CLOUDBASE_ENV_ID、CLOUDBASE_SECRET_ID、CLOUDBASE_SECRET_KEY正确

# 测试网络连接
ping tcb-api.tencentcloudapi.com
```

#### 4. SSL证书问题
```bash
# 检查证书状态
sudo certbot certificates

# 手动续期
sudo certbot renew

# 查看续期日志
cat /var/log/petmeet/ssl-renewal.log
```

### 日志位置

- **应用日志**: `/var/log/petmeet/`
- **Nginx日志**: `/var/log/nginx/`
- **PM2日志**: `~/.pm2/logs/`
- **系统日志**: `/var/log/syslog` (Ubuntu) 或 `/var/log/messages` (CentOS)

## 🔄 更新部署

当有代码更新时：

```bash
# 1. 备份当前版本
/opt/petmeet/backup.sh

# 2. 下载新代码
cd ~/petmeet-backend
git pull origin main

# 3. 更新后端
cp -r . /opt/petmeet/backend/
cd /opt/petmeet/backend
npm install --production

# 4. 更新管理面板
cp -r 管理面板/* /opt/petmeet/admin-panel/
cd /opt/petmeet/admin-panel
npm install --production

# 5. 重启服务
/opt/petmeet/restart.sh
```

## 📈 扩展建议

### 1. 数据库优化
- 配置CloudBase读写分离
- 设置合适的索引
- 定期清理过期数据

### 2. CDN加速
- 使用腾讯云CDN加速静态资源
- 配置图片压缩和缓存

### 3. 负载均衡
- 多台服务器部署
- 使用腾讯云CLB负载均衡

### 4. 监控告警
- 配置腾讯云监控
- 设置关键指标告警

## 📞 技术支持

如果在部署过程中遇到问题：

1. 查看详细日志分析问题
2. 检查防火墙和安全组配置
3. 确认域名解析是否正确
4. 验证腾讯云服务配置

## 📝 安全建议

1. **定期更新**: 保持系统和依赖包更新
2. **备份策略**: 定期备份数据和配置
3. **访问控制**: 限制管理面板访问IP
4. **密钥管理**: 定期更换JWT密钥
5. **日志监控**: 监控异常访问行为

---

**部署完成后，你的PetMeet应用就可以正式投入使用了！** 🎉 