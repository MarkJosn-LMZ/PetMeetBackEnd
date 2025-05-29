# AI模型配置数据库化设置指南

## 概述

此脚本系统将把项目中所有AI模型配置从硬编码方式迁移到数据库存储，实现：
- ✅ 动态模型管理
- ✅ 统一配置中心
- ✅ API密钥安全存储
- ✅ 模型配置版本控制
- ✅ 支持文字和图像模型

## 当前AI模型配置分析

### 📝 文字模型 (11个)

| 模型名称 | 提供商 | API密钥 | baseURL | 支持功能 |
|---------|-------|---------|---------|----------|
| DeepSeek-R1-腾讯代理 | deepseek-tencent | TENCENT_AI_API_KEY | cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com | 流式输出、思维链 |
| DeepSeek-R1-原生 | deepseek-native | DEEP_SEEK_API_KEY | api.deepseek.com | 流式输出、思维链 |
| DeepSeek-V3 | deepseek-native | DEEP_SEEK_API_KEY | api.deepseek.com | 流式输出 |
| 腾讯混元 | hunyuan-exp | TENCENT_AI_API_KEY | cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com | 流式输出 |
| DouBao-1.5-思维版 | DouBao | DOU_BAO_API_KEY | ark.cn-beijing.volces.com | 流式输出、思维链 |
| DouBao-Pro-32K | DouBao | DOU_BAO_API_KEY | ark.cn-beijing.volces.com | 流式输出、32K上下文 |
| DouBao-Pro-128K | DouBao | DOU_BAO_API_KEY | ark.cn-beijing.volces.com | 流式输出、128K上下文 |
| DouBao-Lite-32K | DouBao | DOU_BAO_API_KEY | ark.cn-beijing.volces.com | 流式输出、轻量级 |
| DouBao-Lite-128K | DouBao | DOU_BAO_API_KEY | ark.cn-beijing.volces.com | 流式输出、轻量级 |
| DeepSeek-Chat | deepseek-native | DEEP_SEEK_API_KEY | api.deepseek.com | 对话优化 |
| DeepSeek-Coder | deepseek-native | DEEP_SEEK_API_KEY | api.deepseek.com | 编程优化 |

### 🎨 图像模型 (4个)

| 模型名称 | 提供商 | API密钥 | baseURL | 支持功能 |
|---------|-------|---------|---------|----------|
| DouBao-SeeDream | DouBao | DOU_BAO_API_KEY | ark.cn-beijing.volces.com | 多尺寸、引导控制 |
| DALL-E-3 | OpenAI | DEEP_SEEK_API_KEY | api.deepseek.com | 高质量艺术创作 |
| DALL-E-2 | OpenAI | DEEP_SEEK_API_KEY | api.deepseek.com | 经典版本 |
| 腾讯图像生成 | Tencent | TENCENT_AI_API_KEY | cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com | 腾讯自研 |

## 使用步骤

### 1️⃣ 准备环境变量

```bash
# 查看当前环境变量状态
env | grep -E "(API_KEY|SECRET)" | sort

# 如果没有设置，创建 .env 文件
cp scripts/env-template.txt .env
```

编辑 `.env` 文件，填入你的API密钥：

```bash
# 必需的API密钥
TENCENT_AI_API_KEY=你的腾讯云AI_API密钥
DEEP_SEEK_API_KEY=你的DeepSeek_API密钥
DOU_BAO_API_KEY=你的豆包API密钥

# 数据库配置
CLOUDBASE_ENV_ID=cloud1-9g9n1il77a00ffbc
JWT_SECRET=your-secret-key
```

### 2️⃣ 运行保存脚本

```bash
# 安装依赖（如果需要）
npm install

# 运行AI模型配置保存脚本
node scripts/save-ai-models-to-db.js
```

### 3️⃣ 验证保存结果

脚本执行后会显示详细的保存结果：

```
🚀 开始将AI模型配置保存到数据库...

📊 检查当前环境变量状态:
   TENCENT_AI_API_KEY: ✅ 已设置
   DEEP_SEEK_API_KEY: ✅ 已设置
   DOU_BAO_API_KEY: ✅ 已设置

📝 准备保存 11 个文字模型：
   ✅ DeepSeek-R1-腾讯代理 (deepseek-r1)
   ✅ DeepSeek-R1-原生 (deepseek-reasoner)
   ...

🎨 准备保存 4 个图像模型：
   ✅ DouBao-SeeDream-图像生成 (doubao-seedream-3-0-t2i-250415)
   ❌ DALL-E-3 (dall-e-3)
   ...

💾 开始批量保存到数据库...
   ✅ DeepSeek-R1-腾讯代理 🔑
   ✅ DeepSeek-R1-原生 🔑
   ...

📈 保存结果统计:
   ✅ 成功保存: 15 个模型
   ❌ 保存失败: 0 个模型
   📊 总计: 15 个模型配置

🔍 验证数据库中的模型配置...
   📝 文字模型: 11 个
   🎨 图像模型: 4 个
   ✅ 激活模型: 11 个
   🔑 有效密钥: 11 个
```

### 4️⃣ 使用AI模型管理器

在你的代码中使用新的AI模型管理器：

```javascript
const aiModelManager = require('./utils/aiModelManager');

// 获取所有文字模型
const textModels = await aiModelManager.getTextModels();

// 获取默认模型
const defaultTextModel = await aiModelManager.getDefaultTextModel();
const defaultImageModel = await aiModelManager.getDefaultImageModel();

// 根据提供商获取模型
const douBaoModels = await aiModelManager.getModelsByProvider('DouBao');

// 获取统计信息
const stats = await aiModelManager.getModelStats();
```

## 数据库结构

### AI_Model 集合结构

```json
{
  "_id": "text_deepseek-tencent_deepseek-r1",
  "name": "DeepSeek-R1-腾讯代理",
  "type": "text",
  "model": "deepseek-r1",
  "provider": "deepseek-tencent",
  "apiKey": "实际的API密钥",
  "baseURL": "https://cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com/v1/ai/deepseek/v1",
  "description": "DeepSeek-R1模型通过腾讯云代理访问，支持思维链推理",
  "config": {
    "temperature": 0.7,
    "max_tokens": 4000,
    "supportsStreaming": true,
    "supportsThinking": true
  },
  "isActive": true,
  "createdAt": "2025-01-27T12:00:00.000Z",
  "updatedAt": "2025-01-27T12:00:00.000Z"
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | String | 唯一标识符，格式：`{type}_{provider}_{model}` |
| `name` | String | 模型显示名称 |
| `type` | String | 模型类型：`text` 或 `image` |
| `model` | String | 模型ID，用于API调用 |
| `provider` | String | 提供商名称 |
| `apiKey` | String | API密钥（敏感信息） |
| `baseURL` | String | API基础URL |
| `description` | String | 模型描述 |
| `config` | Object | 模型配置参数 |
| `isActive` | Boolean | 是否激活 |
| `createdAt` | Date | 创建时间 |
| `updatedAt` | Date | 更新时间 |

## 查询示例

### 基础查询

```javascript
// 获取所有激活的文字模型
db.collection('AI_Model').where({
  type: 'text',
  isActive: true
}).get()

// 获取豆包提供商的所有模型
db.collection('AI_Model').where({
  provider: 'DouBao'
}).get()

// 获取支持思维链的模型
db.collection('AI_Model').where({
  'config.supportsThinking': true
}).get()
```

### 高级查询

```javascript
// 获取有API密钥的图像模型
db.collection('AI_Model').where({
  type: 'image',
  apiKey: db.command.neq(null)
}).get()

// 按创建时间排序
db.collection('AI_Model').orderBy('createdAt', 'desc').get()

// 分页查询
db.collection('AI_Model').skip(10).limit(5).get()
```

## 迁移现有代码

### Emergency Check 页面迁移

```javascript
// 原来的硬编码配置
const aiModels = [
  { 
    id: 'deepseek', 
    name: 'DeepSeek-R1（腾讯）',
    model: 'deepseek-r1',
    // ...
  }
];

// 迁移后从数据库加载
async onLoad() {
  const aiModelManager = require('../../utils/aiModelManager');
  const models = await aiModelManager.getEmergencyCheckModels();
  this.setData({ aiModels: models });
}
```

### 后端服务迁移

```javascript
// 原来的硬编码配置
const getAIConfig = (modelName) => {
  const configs = {
    'deepseek-r1': {
      baseURL: 'https://cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com/v1/ai/deepseek/v1',
      apiKey: process.env.TENCENT_AI_API_KEY
    }
  };
  return configs[modelName];
};

// 迁移后从数据库加载
const aiModelManager = require('../utils/aiModelManager');

const getAIConfig = async (modelName) => {
  const model = await aiModelManager.getModelByName(modelName);
  if (!model) {
    throw new Error(`模型 ${modelName} 未找到`);
  }
  return {
    baseURL: model.baseURL,
    apiKey: model.apiKey,
    config: model.config
  };
};
```

## 管理功能

### 1. 模型状态管理

```javascript
// 激活/停用模型
await aiModelManager.setModelActive('text_DouBao_doubao-pro-32k', false);

// 更新模型配置
await aiModelManager.updateModel('text_DouBao_doubao-pro-32k', {
  'config.temperature': 0.8,
  'config.max_tokens': 3000
});
```

### 2. 模型验证

```javascript
// 验证模型配置
const model = await aiModelManager.getModelById('text_DouBao_doubao-pro-32k');
const validation = aiModelManager.validateModel(model);

if (!validation.isValid) {
  console.error('模型配置错误:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('模型配置警告:', validation.warnings);
}
```

### 3. 统计信息

```javascript
// 获取统计信息
const stats = await aiModelManager.getModelStats();
console.log(`总模型数: ${stats.total}`);
console.log(`文字模型: ${stats.text}，图像模型: ${stats.image}`);
console.log(`激活模型: ${stats.active}`);
console.log(`有效密钥: ${stats.withApiKey}`);
console.log('按提供商分布:', stats.byProvider);
```

## 安全性考虑

### 1. API密钥保护

- ✅ API密钥存储在数据库中，不在前端暴露
- ✅ 支持环境变量配置
- ✅ 可以实现密钥轮换机制

### 2. 访问控制

- ✅ 后端验证API调用权限
- ✅ 前端不直接访问API密钥
- ✅ 支持模型级别的启用/禁用

### 3. 数据验证

- ✅ 模型配置完整性检查
- ✅ API密钥有效性验证
- ✅ 参数范围检查

## 故障排除

### 常见问题

1. **环境变量未设置**
   ```
   ⚠️  环境变量 TENCENT_AI_API_KEY 未设置
   ```
   解决：创建 `.env` 文件并设置对应的API密钥

2. **数据库连接失败**
   ```
   ❌ 保存AI模型配置时发生错误: CloudBase未初始化
   ```
   解决：检查 `CLOUDBASE_ENV_ID` 环境变量是否正确设置

3. **模型配置验证失败**
   ```
   缺少必需字段: baseURL
   ```
   解决：检查模型配置是否完整

### 调试模式

启用详细日志：

```bash
DEBUG=ai-model* node scripts/save-ai-models-to-db.js
```

## 后续优化建议

1. **Web管理界面**：创建一个Web界面来管理AI模型配置
2. **API密钥轮换**：实现定期更换API密钥的机制
3. **使用量统计**：记录每个模型的使用频率和成本
4. **A/B测试**：支持多个模型同时测试，选择最优模型
5. **缓存优化**：实现更智能的缓存策略
6. **监控告警**：当模型不可用时发送告警

## 总结

通过这个脚本系统，你的AI模型配置将：
- 📊 集中管理，统一维护
- 🔒 安全存储，避免硬编码
- 🚀 动态加载，实时更新
- 📈 可监控，可统计
- 🛠️ 易扩展，易维护

运行脚本后，所有AI模型配置都将保存在数据库中，你可以通过 `aiModelManager` 工具轻松管理和使用这些配置。 