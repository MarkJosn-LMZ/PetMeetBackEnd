#!/bin/bash

# 更新生产环境nginx配置脚本
# 修复管理面板API路由问题

echo "🔧 更新nginx配置以修复管理面板登录问题..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# 检查nginx配置文件是否存在
if [[ ! -f /etc/nginx/sites-available/petmeet ]]; then
    error "nginx配置文件不存在: /etc/nginx/sites-available/petmeet"
    exit 1
fi

# 备份当前配置
log "备份当前nginx配置..."
sudo cp /etc/nginx/sites-available/petmeet /etc/nginx/sites-available/petmeet.backup.$(date +%Y%m%d_%H%M%S)

# 更新nginx配置
log "更新nginx配置..."
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
    
    # 认证API代理
    location /auth/ {
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

# 测试nginx配置
log "测试nginx配置..."
sudo nginx -t

if [[ $? -eq 0 ]]; then
    log "nginx配置测试通过，重载配置..."
    sudo systemctl reload nginx
    log "✅ nginx配置更新完成！"
    
    echo ""
    echo "=========================================="
    log "🎉 nginx配置更新成功！"
    echo "=========================================="
    echo ""
    echo "主要修改："
    echo "  ✅ /api/admin/* 现在会优先路由到管理面板服务器 (3001端口)"
    echo "  ✅ /api/* 其他请求路由到后端服务器 (3000端口)"
    echo "  ✅ 管理面板登录问题应该已解决"
    echo ""
    echo "请重新尝试登录管理面板："
    echo "  🔗 管理面板地址: http://your-server-ip/admin/"
    echo ""
    
else
    error "nginx配置测试失败，正在恢复备份配置..."
    sudo cp /etc/nginx/sites-available/petmeet.backup.$(date +%Y%m%d)* /etc/nginx/sites-available/petmeet
    sudo systemctl reload nginx
    error "配置已恢复，请检查错误信息"
    exit 1
fi 