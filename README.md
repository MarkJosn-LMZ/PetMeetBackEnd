# PetMeet 后端项目

## 项目简介
PetMeet是一个宠物社交平台的后端API系统，基于Node.js + Express + CloudBase构建。

## 功能模块

### 用户认证
- 用户注册/登录
- JWT身份验证
- 会员系统管理

### 宠物管理
- 宠物信息CRUD
- 宠物档案管理
- 健康记录管理

### 健康管理 (新增)
- 体重记录管理
- 饮食记录管理
- 运动记录管理
- 疫苗记录管理
- 驱虫记录管理
- 体检记录管理
- 宠物健康数据汇总

### 社交功能
- 动态发布
- 评论/点赞
- 话题管理
- 搜索功能

### 文件存储
- 本地文件上传
- 云端文件管理

## API接口文档

### 健康管理 API

#### 体重记录
- `GET /api/health/weight` - 获取体重记录列表
- `GET /api/health/weight/:id` - 获取体重记录详情
- `POST /api/health/weight` - 创建体重记录
- `PUT /api/health/weight/:id` - 更新体重记录
- `DELETE /api/health/weight/:id` - 删除体重记录

#### 饮食记录
- `GET /api/health/diet` - 获取饮食记录列表
- `GET /api/health/diet/:id` - 获取饮食记录详情
- `POST /api/health/diet` - 创建饮食记录
- `PUT /api/health/diet/:id` - 更新饮食记录
- `DELETE /api/health/diet/:id` - 删除饮食记录

#### 运动记录
- `GET /api/health/exercise` - 获取运动记录列表
- `GET /api/health/exercise/:id` - 获取运动记录详情
- `POST /api/health/exercise` - 创建运动记录
- `PUT /api/health/exercise/:id` - 更新运动记录
- `DELETE /api/health/exercise/:id` - 删除运动记录

#### 疫苗记录
- `GET /api/health/vaccine` - 获取疫苗记录列表
- `GET /api/health/vaccine/:id` - 获取疫苗记录详情
- `POST /api/health/vaccine` - 创建疫苗记录
- `PUT /api/health/vaccine/:id` - 更新疫苗记录
- `DELETE /api/health/vaccine/:id` - 删除疫苗记录

#### 驱虫记录
- `GET /api/health/deworming` - 获取驱虫记录列表
- `GET /api/health/deworming/:id` - 获取驱虫记录详情
- `POST /api/health/deworming` - 创建驱虫记录
- `PUT /api/health/deworming/:id` - 更新驱虫记录
- `DELETE /api/health/deworming/:id` - 删除驱虫记录

#### 体检记录
- `GET /api/health/examination` - 获取体检记录列表
- `GET /api/health/examination/:id` - 获取体检记录详情
- `POST /api/health/examination` - 创建体检记录
- `PUT /api/health/examination/:id` - 更新体检记录
- `DELETE /api/health/examination/:id` - 删除体检记录

#### 健康数据汇总
- `GET /api/health/pet/:pet_id` - 获取宠物健康汇总数据

### 请求参数说明

#### 疫苗记录创建参数
```json
{
  "vaccineName": "狂犬疫苗",
  "vaccineType": "预防疫苗",
  "dueDate": "2024-01-15",
  "status": "计划中",
  "location": "宠物医院",
  "description": "年度疫苗接种",
  "pet_id": "宠物ID",
  "PetMeetID": "PetMeet系统ID"
}
```

#### 驱虫记录创建参数
```json
{
  "dewormingType": "体内驱虫",
  "drugName": "阿苯达唑",
  "dueDate": "2024-01-15",
  "status": "计划中",
  "location": "宠物医院",
  "description": "定期驱虫",
  "pet_id": "宠物ID",
  "PetMeetID": "PetMeet系统ID"
}
```

#### 体检记录创建参数
```json
{
  "examinationType": "年度体检",
  "hospital": "爱宠动物医院",
  "doctor": "张医生",
  "dueDate": "2024-01-15",
  "status": "计划中",
  "results": "各项指标正常",
  "description": "年度常规体检",
  "pet_id": "宠物ID",
  "PetMeetID": "PetMeet系统ID"
}
```

## 技术栈
- Node.js + Express
- 腾讯云CloudBase
- JWT身份验证
- Morgan日志
- Multer文件上传

## 安装和启动

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 启动生产服务器
npm run prod
```

## 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 服务器端口
PORT=3000

# CloudBase配置
CLOUDBASE_ENV_ID=your_env_id
CLOUDBASE_SECRET_ID=your_secret_id
CLOUDBASE_SECRET_KEY=your_secret_key

# JWT密钥
JWT_SECRET=your_jwt_secret

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=petmeet
DB_USER=root
DB_PASS=password
```

## 数据库集合

### 健康管理相关集合
- `ai_weight_record` - 体重记录
- `ai_diet_record` - 饮食记录
- `ai_exercise_record` - 运动记录
- `ai_vaccine` - 疫苗记录
- `ai_deworming` - 驱虫记录
- `ai_examination` - 体检记录

### 其他集合
- `users` - 用户信息
- `pets` - 宠物信息
- `posts` - 动态内容
- `comments` - 评论信息
- `topics` - 话题管理

## 版本更新

### v2.0 (当前版本)
- ✅ 添加健康管理模块
- ✅ 实现疫苗记录CRUD
- ✅ 实现驱虫记录CRUD
- ✅ 实现体检记录CRUD
- ✅ 更新健康数据汇总接口
- ✅ 删除PetService依赖，使用healthController统一处理

### v1.0 
- 基础用户系统
- 宠物管理
- 社交功能
- 文件上传

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT License
