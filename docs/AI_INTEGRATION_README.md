# PetMeet 通用AI引擎集成说明

## 概述

本项目已成功集成通用AI引擎，为各种业务场景提供灵活的AI服务。AI引擎支持多种模型（默认为腾讯云DeepSeek V3），并允许前端完全自定义提示词、模型选择和业务逻辑，实现最大的兼容性和扩展性。

## 功能特性

### 🤖 通用AI服务
- **模型灵活性**: 支持任意AI模型，不限于特定业务场景
- **提示词自定义**: 完全由前端控制，支持任意业务逻辑
- **多场景应用**: 可用于营养评估、健康咨询、通用对话等
- **流式支持**: 支持流式和非流式两种响应模式

### 🔧 技术架构
- **后端**: Node.js + Express + OpenAI SDK
- **前端**: 微信小程序原生框架
- **AI模型**: 支持多种模型（默认：腾讯云DeepSeek V3）
- **API设计**: RESTful风格，完全通用化

## 安装配置

### 1. 安装依赖

```bash
# 后端依赖
cd 后端
npm install openai

# 前端依赖已包含在现有项目中
```

### 2. 环境变量配置

在后端项目根目录创建 `.env` 文件：

```env
# 腾讯云AI服务配置
TENCENT_AI_API_KEY=your_tencent_ai_api_key_here

# DeepSeek原生API配置
DEEP_SEEK_API_KEY=your_deepseek_api_key_here

# 其他环境变量
PORT=3000
NODE_ENV=development
```

### 3. 获取API Key

1. 登录腾讯云控制台
2. 开通AI服务
3. 获取API Key
4. 将API Key配置到环境变量中

## API接口说明

### 通用AI处理接口

#### 非流式处理
```http
POST /api/ai/process
Authorization: Bearer <token>
Content-Type: application/json

{
  "systemPrompt": "你是一位专业的宠物营养师...",
  "userPrompt": "请评估以下宠物的营养状况...",
  "model": "deepseek-v3",
  "options": {
    "temperature": 0.3,
    "max_tokens": 1000
  },
  "conversationHistory": []
}
```

#### 流式处理
```http
POST /api/ai/process-stream
```
参数同上，返回流式文本响应。

### 宠物营养评估接口（兼容性保留）

#### 非流式评估
```http
POST /api/ai/nutrition/assess
Authorization: Bearer <token>
Content-Type: application/json

{
  "petInfo": {
    "id": "pet_id",
    "name": "宠物名称",
    "breed": "品种",
    "age": "年龄",
    "weight": "体重",
    "gender": "性别",
    "bodyType": "体型状态"
  },
  "dietRecords": [
    {
      "time": "08:00",
      "foodName": "狗粮",
      "amount": "100g",
      "foodType": "主食"
    }
  ],
  "customPrompt": {
    "systemPrompt": "自定义系统提示词",
    "userPrompt": "自定义用户提示词",
    "model": "deepseek-v3",
    "temperature": 0.3,
    "max_tokens": 1000
  }
}
```

### 通用AI对话接口

```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    {
      "role": "system",
      "content": "你是一位专业的宠物营养师"
    },
    {
      "role": "user", 
      "content": "请评估我的宠物营养状况"
    }
  ],
  "options": {
    "model": "deepseek-v3",
    "temperature": 0.7,
    "max_tokens": 2000
  }
}
```

### 服务状态检查

```http
GET /api/ai/status?model=deepseek-v3
Authorization: Bearer <token>
```

### 支持的模型列表

```http
GET /api/ai/models
Authorization: Bearer <token>
```

## 前端使用方法

### 1. 导入AI工具

```javascript
const AIUtils = require('../../../utils/aiUtils');
```

### 2. 通用AI请求

```javascript
// 构建自定义提示词
const systemPrompt = `你是一位专业的宠物健康顾问，具有丰富的临床经验。
请根据提供的症状信息，给出专业的建议。

要求：
1. 分析症状的可能原因
2. 提供初步的处理建议
3. 建议是否需要就医
4. 回复要专业但易懂`;

const userPrompt = `宠物症状：
- 品种：金毛犬
- 年龄：3岁
- 症状：食欲不振，精神萎靡
- 持续时间：2天

请给出专业建议。`;

// 调用通用AI服务
const result = await AIUtils.processAIRequest({
  systemPrompt,
  userPrompt,
  model: 'deepseek-v3',
  options: {
    temperature: 0.3,
    max_tokens: 800
  }
});

if (result.success) {
  console.log('AI建议:', result.response);
} else {
  console.error('请求失败:', result.error);
}
```

### 3. 营养评估（专用方法）

```javascript
// 格式化宠物信息
const petInfo = AIUtils.formatPetInfoForAssessment(petData);

// 格式化饮食记录
const dietRecords = AIUtils.formatDietRecordsForAssessment(mealData);

// 创建自定义配置
const customOptions = AIUtils.createCustomNutritionPrompt({
  focusArea: '体重管理',
  petSpecialCondition: '关节炎',
  assessmentStyle: 'detailed',
  model: 'deepseek-v3',
  temperature: 0.2
});

// 调用营养评估
const result = await AIUtils.assessPetNutrition(petInfo, dietRecords, customOptions);

if (result.success) {
  console.log('评估结果:', result.assessment);
} else {
  console.error('评估失败:', result.error);
}
```

### 4. 多轮对话

```javascript
// 构建对话消息
const messages = [
  {
    role: "system",
    content: "你是一位宠物行为专家，专门帮助解决宠物行为问题。"
  },
  {
    role: "user",
    content: "我的狗狗最近总是乱叫，特别是晚上，怎么办？"
  },
  {
    role: "assistant",
    content: "狗狗夜间乱叫可能有几个原因..."
  },
  {
    role: "user",
    content: "如果是因为焦虑，有什么具体的训练方法吗？"
  }
];

// 调用对话接口
const result = await AIUtils.chat(messages, {
  model: 'deepseek-v3',
  temperature: 0.6,
  max_tokens: 1500
});
```

### 5. 检查服务状态

```javascript
// 检查特定模型状态
const status = await AIUtils.checkServiceStatus('deepseek-v3');
console.log('AI服务可用:', status.available);

// 获取支持的模型列表
const models = await AIUtils.getSupportedModels();
console.log('支持的模型:', models.models);
```

## 业务场景扩展示例

### 宠物健康咨询

```javascript
const healthConsultation = await AIUtils.processAIRequest({
  systemPrompt: `你是一位资深的宠物兽医，具有20年临床经验。
  请根据宠物主人描述的症状，提供专业的医疗建议。
  
  注意：
  1. 不能替代实际诊断
  2. 严重症状建议立即就医
  3. 提供实用的护理建议`,
  
  userPrompt: `我的猫咪出现以下症状：
  - 品种：英短
  - 年龄：2岁
  - 症状：呕吐、不吃东西
  - 持续时间：1天
  
  请给出建议。`,
  
  model: 'deepseek-v3',
  options: {
    temperature: 0.2,
    max_tokens: 1000
  }
});
```

### 宠物训练指导

```javascript
const trainingAdvice = await AIUtils.processAIRequest({
  systemPrompt: `你是一位专业的宠物训练师，擅长各种宠物行为矫正。
  请提供实用、循序渐进的训练方案。`,
  
  userPrompt: `如何训练3个月大的金毛幼犬定点大小便？`,
  
  model: 'deepseek-v3',
  options: {
    temperature: 0.4,
    max_tokens: 1200
  }
});
```

### 宠物用品推荐

```javascript
const productRecommendation = await AIUtils.processAIRequest({
  systemPrompt: `你是一位宠物用品专家，了解各种宠物的需求。
  请根据宠物的具体情况，推荐合适的用品。`,
  
  userPrompt: `为一只5公斤的成年比熊犬推荐合适的玩具和用品。`,
  
  model: 'deepseek-v3',
  options: {
    temperature: 0.5,
    max_tokens: 800
  }
});
```

## 自定义配置详解

### 模型参数说明

```javascript
const aiConfig = {
  model: 'deepseek-v3',        // 模型名称
  temperature: 0.3,            // 创造性程度 (0-1)
  max_tokens: 1000,           // 最大输出长度
  // 未来可扩展更多参数
};
```

### 提示词模板系统

```javascript
// 构建系统提示词
const systemPrompt = AIUtils.buildSystemPrompt({
  role: '宠物营养师',
  expertise: '宠物营养学和健康管理',
  style: 'friendly',
  constraints: [
    '回复控制在40字以内',
    '提供具体可行的建议',
    '必要时建议咨询兽医'
  ]
});

// 使用模板
const result = await AIUtils.processAIRequest({
  systemPrompt,
  userPrompt: '具体的问题描述...',
  model: 'deepseek-v3'
});
```

## 错误处理

### 参数验证

```javascript
// 验证AI请求参数
const validation = AIUtils.validateAIParams({
  systemPrompt: 'your system prompt',
  userPrompt: 'your user prompt',
  model: 'deepseek-v3'
});

if (!validation.valid) {
  console.error('参数错误:', validation.error);
  return;
}
```

### 错误处理

```javascript
try {
  const result = await AIUtils.processAIRequest(params);
  if (!result.success) {
    const friendlyError = AIUtils.handleAIError(new Error(result.error));
    wx.showToast({ title: friendlyError, icon: 'none' });
  }
} catch (error) {
  const friendlyError = AIUtils.handleAIError(error);
  wx.showToast({ title: friendlyError, icon: 'none' });
}
```

## 性能优化

### 1. 请求缓存
```javascript
// 可以根据需要实现请求结果缓存
const cacheKey = `ai_${model}_${hashPrompt(systemPrompt + userPrompt)}`;
const cachedResult = wx.getStorageSync(cacheKey);
if (cachedResult) {
  return cachedResult;
}
```

### 2. 分批处理
```javascript
// 对于大量数据，可以分批处理
const batchSize = 5;
const results = [];
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  const batchResult = await processBatch(batch);
  results.push(...batchResult);
}
```

## 扩展功能规划

### 多模型支持

```javascript
// 框架已支持接入多种AI模型
const models = {
  'deepseek-v3': { provider: 'DeepSeek', speciality: '推理' },
  'gpt-4': { provider: 'OpenAI', speciality: '通用' },
  'claude-3': { provider: 'Anthropic', speciality: '分析' }
};

// 根据任务选择最合适的模型
const selectedModel = selectBestModel(taskType);
```

### 智能路由

```javascript
// 未来可以实现智能模型路由
const result = await AIUtils.processAIRequest({
  systemPrompt: prompt,
  userPrompt: question,
  model: 'auto',  // 自动选择最合适的模型
  options: { taskType: 'health_consultation' }
});
```

## 监控与分析

### 使用统计

```javascript
// 可以添加使用统计
const stats = {
  totalRequests: 0,
  successRate: 0.95,
  averageResponseTime: 2.3,
  modelUsage: {
    'deepseek-v3': 0.8,
    'gpt-4': 0.2
  }
};
```

### 质量评估

```javascript
// 可以添加响应质量评估
const qualityScore = await evaluateResponse(question, aiResponse);
if (qualityScore < threshold) {
  // 触发人工审核或重新生成
}
```

## 安全考虑

1. **参数验证**: 严格验证所有输入参数
2. **内容过滤**: 可以添加敏感内容过滤
3. **频率限制**: 实施用户级别的请求频率限制
4. **审计日志**: 记录所有AI交互以便审计

## 总结

通用AI引擎提供了极大的灵活性，支持：

- ✅ 任意模型选择
- ✅ 完全自定义提示词
- ✅ 多种业务场景
- ✅ 流式和非流式响应
- ✅ 向后兼容现有功能
- ✅ 易于扩展新功能

这个架构确保了AI服务能够适应各种未来需求，而不仅仅局限于宠物营养评估。

---

**注意**: 
1. 请确保在生产环境中妥善保护API Key
2. 根据实际需求选择合适的模型和参数
3. 定期监控AI服务的使用情况和效果 