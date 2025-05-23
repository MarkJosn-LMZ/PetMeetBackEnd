#!/bin/bash

# 腾讯云轻量服务器环境配置脚本
# 适用于 Ubuntu 20.04/22.04 或 CentOS 7/8

echo "开始配置PetMeet后端运行环境..."

# 更新系统包
sudo apt update && sudo apt upgrade -y  # Ubuntu
# sudo yum update -y  # CentOS

# 安装 Node.js 18.x LTS版本
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs  # Ubuntu
# curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
# sudo yum install -y nodejs  # CentOS

# 验证安装
node --version
npm --version

# 安装 PM2 进程管理器
sudo npm install -g pm2

# 安装 Nginx 反向代理
sudo apt install -y nginx  # Ubuntu
# sudo yum install -y nginx  # CentOS

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 安装 Git
sudo apt install -y git  # Ubuntu
# sudo yum install -y git  # CentOS

# 创建应用目录
sudo mkdir -p /var/www/petmeet-backend
sudo chown -R $USER:$USER /var/www/petmeet-backend

# 配置防火墙
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # Node.js应用端口
sudo ufw --force enable

echo "环境配置完成！" 