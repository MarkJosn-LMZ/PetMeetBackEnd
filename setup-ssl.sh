#!/bin/bash

# PetMeet SSL证书配置脚本
# 使用Let's Encrypt免费SSL证书

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

# 检查域名参数
if [ $# -eq 0 ]; then
    error "请提供域名参数"
    echo "使用方法: $0 your-domain.com"
    echo "例如: $0 petmeet.example.com"
    exit 1
fi

DOMAIN=$1

log "开始为域名 $DOMAIN 配置SSL证书..."

# 检查操作系统
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

# 安装Certbot
install_certbot() {
    log "安装Certbot..."
    
    if [[ $OS == "centos" ]]; then
        sudo yum install -y epel-release
        sudo yum install -y certbot python3-certbot-nginx
    else
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    log "Certbot安装完成"
}

# 验证域名解析
verify_domain() {
    log "验证域名解析..."
    
    # 获取服务器公网IP
    SERVER_IP=$(curl -s ifconfig.me)
    
    # 检查域名解析
    DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
    
    if [[ "$DOMAIN_IP" != "$SERVER_IP" ]]; then
        warn "警告: 域名 $DOMAIN 解析到 $DOMAIN_IP，但服务器IP是 $SERVER_IP"
        warn "请确保域名已正确解析到服务器IP"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log "域名解析验证通过"
    fi
}

# 更新Nginx配置
update_nginx_config() {
    log "更新Nginx配置..."
    
    # 备份当前配置
    sudo cp /etc/nginx/sites-available/petmeet /etc/nginx/sites-available/petmeet.backup
    
    # 更新域名配置
    sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/petmeet
    
    # 测试配置
    sudo nginx -t
    if [[ $? -eq 0 ]]; then
        sudo systemctl reload nginx
        log "Nginx配置更新完成"
    else
        error "Nginx配置错误，正在恢复备份"
        sudo cp /etc/nginx/sites-available/petmeet.backup /etc/nginx/sites-available/petmeet
        sudo systemctl reload nginx
        exit 1
    fi
}

# 获取SSL证书
obtain_ssl_certificate() {
    log "获取SSL证书..."
    
    # 使用webroot方式获取证书
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    if [[ $? -eq 0 ]]; then
        log "SSL证书获取成功"
    else
        error "SSL证书获取失败"
        exit 1
    fi
}

# 创建自动续期脚本
setup_auto_renewal() {
    log "设置自动续期..."
    
    # 创建续期脚本
    cat > /opt/petmeet/renew-ssl.sh << EOF
#!/bin/bash
# SSL证书自动续期脚本

echo "检查SSL证书续期..."
/usr/bin/certbot renew --quiet

# 重载Nginx配置
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    echo "Nginx配置已重载"
fi

# 记录日志
echo "$(date): SSL证书续期检查完成" >> /var/log/petmeet/ssl-renewal.log
EOF

    chmod +x /opt/petmeet/renew-ssl.sh
    
    # 添加到定时任务
    (crontab -l 2>/dev/null; echo "0 3 * * * /opt/petmeet/renew-ssl.sh") | crontab -
    
    log "自动续期设置完成"
}

# 创建强化SSL配置
create_ssl_config() {
    log "创建SSL安全配置..."
    
    cat > /etc/nginx/conf.d/ssl-security.conf << 'EOF'
# SSL安全配置
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS (HTTP Strict Transport Security)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# 安全头部
add_header X-Frame-Options SAMEORIGIN always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
EOF

    log "SSL安全配置创建完成"
}

# 测试SSL配置
test_ssl() {
    log "测试SSL配置..."
    
    # 测试HTTPS连接
    if curl -s -I https://$DOMAIN | grep -q "200 OK"; then
        log "HTTPS连接测试成功"
    else
        warn "HTTPS连接测试失败，请检查配置"
    fi
    
    # 测试SSL评级（可选）
    log "你可以在以下网站测试SSL配置质量:"
    echo "https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
}

# 更新防火墙规则
update_firewall() {
    log "更新防火墙规则..."
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 443/tcp
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --reload
    fi
    
    log "防火墙规则更新完成"
}

# 主流程
main() {
    log "开始SSL配置流程..."
    
    # 验证域名
    verify_domain
    
    # 安装Certbot
    install_certbot
    
    # 更新Nginx配置
    update_nginx_config
    
    # 获取SSL证书
    obtain_ssl_certificate
    
    # 创建SSL安全配置
    create_ssl_config
    
    # 设置自动续期
    setup_auto_renewal
    
    # 更新防火墙
    update_firewall
    
    # 重载Nginx
    sudo systemctl reload nginx
    
    # 测试SSL
    test_ssl
    
    echo ""
    echo "=========================================="
    log "🔒 SSL证书配置完成！"
    echo "=========================================="
    echo ""
    echo "✅ HTTPS网站: https://$DOMAIN"
    echo "✅ 管理面板: https://$DOMAIN/admin/"
    echo "✅ 后端API: https://$DOMAIN/api/"
    echo ""
    echo "🔄 自动续期已设置（每天凌晨3点检查）"
    echo "📝 续期日志: /var/log/petmeet/ssl-renewal.log"
    echo "🔧 手动续期命令: /opt/petmeet/renew-ssl.sh"
    echo ""
    log "建议在SSL Labs测试SSL配置质量"
}

# 执行主流程
main 