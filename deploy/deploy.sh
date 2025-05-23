#!/bin/bash

# PetMeet 后端一键部署脚本
# 在服务器上运行此脚本进行部署

set -e  # 遇到错误立即停止

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="petmeet-backend"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="https://github.com/yourusername/petmeet-backend.git"  # 替换为您的仓库地址
BRANCH="main"

echo -e "${GREEN}开始部署 PetMeet 后端应用...${NC}"

# 检查是否以root或sudo权限运行
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}请不要以root用户运行此脚本${NC}"
   exit 1
fi

# 1. 创建应用目录
echo -e "${YELLOW}创建应用目录...${NC}"
sudo mkdir -p $APP_DIR
sudo mkdir -p $APP_DIR/logs
sudo mkdir -p $APP_DIR/uploads
sudo chown -R $USER:$USER $APP_DIR

# 2. 克隆或更新代码
if [ -d "$APP_DIR/.git" ]; then
    echo -e "${YELLOW}更新代码...${NC}"
    cd $APP_DIR
    git pull origin $BRANCH
else
    echo -e "${YELLOW}克隆代码仓库...${NC}"
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
    git checkout $BRANCH
fi

# 3. 安装依赖
echo -e "${YELLOW}安装Node.js依赖...${NC}"
npm install --production

# 4. 配置环境变量
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo -e "${YELLOW}复制环境变量模板...${NC}"
    cp deploy/env.production.template .env.production
    echo -e "${RED}请编辑 .env.production 文件配置您的环境变量！${NC}"
    echo "配置完成后，请重新运行部署脚本"
    exit 1
fi

# 5. 配置Nginx
echo -e "${YELLOW}配置Nginx...${NC}"
if [ ! -f "/etc/nginx/sites-available/petmeet" ]; then
    sudo cp deploy/nginx-petmeet.conf /etc/nginx/sites-available/petmeet
    sudo ln -sf /etc/nginx/sites-available/petmeet /etc/nginx/sites-enabled/
    
    # 删除默认配置
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试Nginx配置
    sudo nginx -t
    
    # 重启Nginx
    sudo systemctl reload nginx
fi

# 6. 启动应用
echo -e "${YELLOW}启动应用...${NC}"

# 停止旧进程
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

# 启动新进程
pm2 start ecosystem.config.js --env production

# 保存PM2配置
pm2 save

# 设置PM2开机自启
pm2 startup | tail -1 | sudo bash

# 7. 健康检查
echo -e "${YELLOW}进行健康检查...${NC}"
sleep 5

if curl -f http://localhost:3000/api >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 应用启动成功！${NC}"
    echo -e "${GREEN}访问地址: http://$(curl -s ifconfig.me)/api${NC}"
else
    echo -e "${RED}❌ 应用启动失败，请检查日志${NC}"
    pm2 logs $APP_NAME --lines 20
    exit 1
fi

# 8. 显示状态
echo -e "${GREEN}部署完成！${NC}"
echo "应用状态:"
pm2 status
echo ""
echo "查看日志: pm2 logs $APP_NAME"
echo "重启应用: pm2 restart $APP_NAME"
echo "停止应用: pm2 stop $APP_NAME"
echo ""
echo -e "${YELLOW}请确保在腾讯云控制台中开放以下端口：${NC}"
echo "- 80 (HTTP)"
echo "- 443 (HTTPS, 如果使用SSL)"
echo "- 3000 (Node.js应用端口，可选)" 