#!/bin/bash

# PetMeet 后端和管理面板部署脚本
# 适用于腾讯云 CentOS/Ubuntu 服务器

echo "🚀 开始部署 PetMeet 后端和管理面板..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# 检查操作系统
check_os() {
    if [[ -f /etc/redhat-release ]]; then
        OS="centos"
        PKG_MANAGER="yum"
    elif [[ -f /etc/lsb-release ]]; then
        OS="ubuntu"
        PKG_MANAGER="apt"
    else
        error "不支持的操作系统"
        exit 1
    fi
    log "检测到操作系统: $OS"
}

# 更新系统包
update_system() {
    log "更新系统包..."
    if [[ $OS == "centos" ]]; then
        sudo yum update -y
    else
        sudo apt update && sudo apt upgrade -y
    fi
}

# 安装 Node.js
install_nodejs() {
    log "安装 Node.js 18.x..."
    
    if command -v node &> /dev/null; then
        warn "Node.js 已安装，版本: $(node --version)"
        return
    fi
    
    # 安装 NodeSource repository
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    
    if [[ $OS == "centos" ]]; then
        sudo yum install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    log "Node.js 安装完成，版本: $(node --version)"
    log "npm 版本: $(npm --version)"
}

# 安装 PM2
install_pm2() {
    log "安装 PM2 进程管理器..."
    if command -v pm2 &> /dev/null; then
        warn "PM2 已安装，版本: $(pm2 --version)"
        return
    fi
    
    sudo npm install -g pm2
    
    # 设置 PM2 开机自启
    sudo pm2 startup
    log "PM2 安装完成"
}

# 安装 Nginx
install_nginx() {
    log "安装 Nginx..."
    
    if command -v nginx &> /dev/null; then
        warn "Nginx 已安装"
        return
    fi
    
    if [[ $OS == "centos" ]]; then
        sudo yum install -y nginx
    else
        sudo apt install -y nginx
    fi
    
    sudo systemctl enable nginx
    sudo systemctl start nginx
    log "Nginx 安装完成"
}

# 创建项目目录
create_directories() {
    log "创建项目目录..."
    
    # 创建主项目目录
    sudo mkdir -p /opt/petmeet
    sudo chown $USER:$USER /opt/petmeet
    
    # 创建日志目录
    sudo mkdir -p /var/log/petmeet
    sudo chown $USER:$USER /var/log/petmeet
    
    # 创建备份目录
    sudo mkdir -p /backup/petmeet
    sudo chown $USER:$USER /backup/petmeet
    
    log "目录创建完成"
}

# 部署后端代码
deploy_backend() {
    log "部署后端服务..."
    
    # 复制后端代码
    cp -r . /opt/petmeet/backend
    cd /opt/petmeet/backend
    
    # 排除不需要的文件
    rm -rf node_modules
    rm -rf .git
    rm -rf uploads/*
    
    # 安装依赖
    npm install --production
    
    # 创建上传目录
    mkdir -p uploads
    chmod 755 uploads
    
    log "后端代码部署完成"
}

# 部署管理面板
deploy_admin_panel() {
    log "部署管理面板..."
    
    # 复制管理面板代码
    cp -r 管理面板 /opt/petmeet/admin-panel
    cd /opt/petmeet/admin-panel
    
    # 排除不需要的文件
    rm -rf node_modules
    rm -rf .git
    
    # 安装依赖
    npm install --production
    
    log "管理面板部署完成"
}

# 创建环境变量文件
create_env_files() {
    log "创建环境变量文件..."
    
    # 后端环境变量
    cat > /opt/petmeet/backend/.env << 'EOF'
# 生产环境配置
NODE_ENV=production
PORT=3000

# CloudBase配置
CLOUDBASE_ENV_ID=your_env_id
CLOUDBASE_SECRET_ID=your_secret_id
CLOUDBASE_SECRET_KEY=your_secret_key

# JWT密钥
JWT_SECRET=your_jwt_secret_key_change_this

# 服务器配置
HOST=0.0.0.0

# 日志配置
LOG_LEVEL=info
LOG_FILE=/var/log/petmeet/backend.log

# 文件上传配置
UPLOAD_PATH=/opt/petmeet/backend/uploads
MAX_FILE_SIZE=10485760

# 腾讯云COS配置（可选）
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_BUCKET=your_bucket_name
COS_REGION=your_region

# OpenAI配置（可选）
OPENAI_API_KEY=your_openai_api_key
EOF

    # 管理面板环境变量
    cat > /opt/petmeet/admin-panel/.env << 'EOF'
# 管理面板生产环境配置
NODE_ENV=production
ADMIN_PORT=3001

# JWT密钥（与后端保持一致）
JWT_SECRET=your_jwt_secret_key_change_this

# 后端API地址
BACKEND_API_URL=http://localhost:3000

# 日志配置
LOG_FILE=/var/log/petmeet/admin-panel.log

# 继承后端的CloudBase配置
CLOUDBASE_ENV_ID=your_env_id
CLOUDBASE_SECRET_ID=your_secret_id
CLOUDBASE_SECRET_KEY=your_secret_key
EOF

    warn "⚠️  请编辑以下文件并填入实际的配置信息："
    warn "   - /opt/petmeet/backend/.env"
    warn "   - /opt/petmeet/admin-panel/.env"
}

# 创建 PM2 配置文件
create_pm2_config() {
    log "创建 PM2 配置文件..."
    
    cat > /opt/petmeet/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'petmeet-backend',
      script: '/opt/petmeet/backend/app.js',
      cwd: '/opt/petmeet/backend',
      instances: 2, // 根据CPU核心数调整
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      error_file: '/var/log/petmeet/backend-error.log',
      out_file: '/var/log/petmeet/backend-out.log',
      log_file: '/var/log/petmeet/backend.log',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'petmeet-admin',
      script: '/opt/petmeet/admin-panel/server.js',
      cwd: '/opt/petmeet/admin-panel',
      instances: 1,
      max_memory_restart: '512M',
      error_file: '/var/log/petmeet/admin-error.log',
      out_file: '/var/log/petmeet/admin-out.log',
      log_file: '/var/log/petmeet/admin.log',
      time: true,
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        ADMIN_PORT: 3001
      }
    }
  ]
};
EOF

    log "PM2 配置文件创建完成"
}

# 配置 Nginx
configure_nginx() {
    log "配置 Nginx..."
    
    # 备份原配置
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # 创建站点配置
    sudo tee /etc/nginx/sites-available/petmeet << 'EOF'
# PetMeet 后端API
upstream petmeet_backend {
    server 127.0.0.1:3000;
}

# PetMeet 管理面板
upstream petmeet_admin {
    server 127.0.0.1:3001;
}

# HTTP服务器配置
server {
    listen 80;
    server_name your-domain.com; # 替换为你的域名或IP
    
    # 安全头部
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 文件上传大小限制
    client_max_body_size 50M;
    
    # 管理面板API - 优先匹配，先经过管理面板服务器
    location /api/admin/ {
        proxy_pass http://petmeet_admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 后端API代理 - 匹配其他API请求
    location /api/ {
        proxy_pass http://petmeet_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 静态文件服务（上传的文件）
    location /uploads/ {
        alias /opt/petmeet/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # 管理面板
    location /admin/ {
        proxy_pass http://petmeet_admin/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 默认路由到后端
    location / {
        proxy_pass http://petmeet_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

    # 启用站点配置
    if [[ $OS == "ubuntu" ]]; then
        sudo ln -sf /etc/nginx/sites-available/petmeet /etc/nginx/sites-enabled/
        sudo rm -f /etc/nginx/sites-enabled/default
    else
        sudo ln -sf /etc/nginx/sites-available/petmeet /etc/nginx/conf.d/petmeet.conf
    fi
    
    # 测试配置
    sudo nginx -t
    if [[ $? -eq 0 ]]; then
        sudo systemctl reload nginx
        log "Nginx 配置完成"
    else
        error "Nginx 配置错误，请检查配置文件"
        exit 1
    fi
}

# 启动服务
start_services() {
    log "启动服务..."
    
    cd /opt/petmeet
    
    # 启动 PM2 应用
    pm2 start ecosystem.config.js --env production
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置 PM2 开机自启
    sudo pm2 startup
    
    log "服务启动完成"
}

# 创建管理脚本
create_management_scripts() {
    log "创建管理脚本..."
    
    # 创建启动脚本
    cat > /opt/petmeet/start.sh << 'EOF'
#!/bin/bash
cd /opt/petmeet
pm2 start ecosystem.config.js --env production
sudo systemctl start nginx
echo "PetMeet 服务已启动"
EOF

    # 创建停止脚本
    cat > /opt/petmeet/stop.sh << 'EOF'
#!/bin/bash
pm2 stop all
sudo systemctl stop nginx
echo "PetMeet 服务已停止"
EOF

    # 创建重启脚本
    cat > /opt/petmeet/restart.sh << 'EOF'
#!/bin/bash
cd /opt/petmeet
pm2 reload all
sudo systemctl reload nginx
echo "PetMeet 服务已重启"
EOF

    # 创建状态检查脚本
    cat > /opt/petmeet/status.sh << 'EOF'
#!/bin/bash
echo "=== PM2 进程状态 ==="
pm2 status

echo -e "\n=== Nginx 状态 ==="
sudo systemctl status nginx --no-pager

echo -e "\n=== 端口使用情况 ==="
sudo netstat -tlnp | grep -E ':3000|:3001|:80'

echo -e "\n=== 磁盘使用情况 ==="
df -h /opt/petmeet

echo -e "\n=== 内存使用情况 ==="
free -h
EOF

    # 创建日志查看脚本
    cat > /opt/petmeet/logs.sh << 'EOF'
#!/bin/bash
case $1 in
    "backend")
        pm2 logs petmeet-backend
        ;;
    "admin")
        pm2 logs petmeet-admin
        ;;
    "nginx")
        sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
        ;;
    *)
        echo "使用方法: $0 [backend|admin|nginx]"
        echo "查看所有日志: pm2 logs"
        ;;
esac
EOF

    # 创建备份脚本
    cat > /opt/petmeet/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/petmeet/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "开始备份 PetMeet..."

# 备份代码
cp -r /opt/petmeet/backend $BACKUP_DIR/
cp -r /opt/petmeet/admin-panel $BACKUP_DIR/
cp /opt/petmeet/ecosystem.config.js $BACKUP_DIR/

# 备份配置文件
cp /etc/nginx/sites-available/petmeet $BACKUP_DIR/nginx.conf

# 备份日志（最近7天）
find /var/log/petmeet -name "*.log" -mtime -7 -exec cp {} $BACKUP_DIR/ \;

# 压缩备份
cd /backup/petmeet
tar -czf "petmeet_backup_$(date +%Y%m%d_%H%M%S).tar.gz" $(basename $BACKUP_DIR)

echo "备份完成: $BACKUP_DIR"
echo "压缩文件: /backup/petmeet/petmeet_backup_$(date +%Y%m%d_%H%M%S).tar.gz"

# 清理30天前的备份
find /backup/petmeet -name "petmeet_backup_*.tar.gz" -mtime +30 -delete
find /backup/petmeet -type d -mtime +30 -exec rm -rf {} +
EOF

    # 设置执行权限
    chmod +x /opt/petmeet/*.sh
    
    log "管理脚本创建完成"
}

# 设置防火墙
setup_firewall() {
    log "配置防火墙..."
    
    if command -v ufw &> /dev/null; then
        # Ubuntu UFW
        sudo ufw allow 22    # SSH
        sudo ufw allow 80    # HTTP
        sudo ufw allow 443   # HTTPS (备用)
        sudo ufw --force enable
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS firewalld
        sudo firewall-cmd --permanent --add-service=ssh
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --reload
    fi
    
    log "防火墙配置完成"
}

# 性能优化
optimize_system() {
    log "系统性能优化..."
    
    # 增加文件描述符限制
    echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
    echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
    
    # 优化内核参数
    cat >> /etc/sysctl.conf << 'EOF'
# PetMeet 优化配置
net.core.somaxconn = 1024
net.core.netdev_max_backlog = 5000
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_congestion_control = bbr
EOF
    
    sudo sysctl -p
    
    log "系统优化完成"
}

# 主部署流程
main() {
    log "开始 PetMeet 部署流程..."
    
    # 检查是否为root用户
    if [[ $EUID -eq 0 ]]; then
        error "请不要使用root用户运行此脚本"
        exit 1
    fi
    
    # 检查操作系统
    check_os
    
    # 更新系统
    update_system
    
    # 安装依赖
    install_nodejs
    install_pm2
    install_nginx
    
    # 创建目录
    create_directories
    
    # 部署代码
    deploy_backend
    deploy_admin_panel
    
    # 创建配置文件
    create_env_files
    create_pm2_config
    configure_nginx
    
    # 创建管理脚本
    create_management_scripts
    
    # 安全配置
    setup_firewall
    
    # 性能优化
    optimize_system
    
    # 启动服务
    start_services
    
    echo ""
    echo "=========================================="
    log "🎉 PetMeet 部署完成！"
    echo "=========================================="
    echo ""
    echo "📂 项目目录: /opt/petmeet"
    echo "📊 管理面板: http://your-server-ip/admin/"
    echo "🔗 后端API: http://your-server-ip/api/"
    echo ""
    echo "🛠️ 管理命令:"
    echo "   启动服务: /opt/petmeet/start.sh"
    echo "   停止服务: /opt/petmeet/stop.sh"
    echo "   重启服务: /opt/petmeet/restart.sh"
    echo "   查看状态: /opt/petmeet/status.sh"
    echo "   查看日志: /opt/petmeet/logs.sh [backend|admin|nginx]"
    echo "   备份数据: /opt/petmeet/backup.sh"
    echo ""
    echo "⚠️ 重要提醒:"
    echo "   1. 请编辑 /opt/petmeet/backend/.env 配置腾讯云信息"
    echo "   2. 请编辑 /opt/petmeet/admin-panel/.env 配置管理面板"
    echo "   3. 请修改 /etc/nginx/sites-available/petmeet 中的域名"
    echo "   4. 建议配置SSL证书启用HTTPS"
    echo ""
    warn "⚠️ 配置完环境变量后，请运行: /opt/petmeet/restart.sh"
}

# 执行主流程
main "$@" 