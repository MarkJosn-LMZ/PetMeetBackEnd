const OpenAI = require("openai");

/**
 * 通用AI服务类 - 纯技术服务层
 * 
 * 设计原则：
 * - 不包含任何业务逻辑或默认值
 * - 所有参数（模型、温度、token数）必须由调用方提供
 * - 仅提供AI调用的技术实现
 * - 支持任意模型和AI服务提供商
 */
class AIService {
  constructor() {
    // 从环境变量获取默认API Key
    this.defaultApiKey = process.env.TENCENT_AI_API_KEY;
    
    if (!this.defaultApiKey) {
      console.warn('[AI服务] 警告: 未设置TENCENT_AI_API_KEY环境变量');
    }
    
    // 不再创建固定的client，改为动态创建
    // this.client 将在每次调用时根据baseURL和apiKey动态创建
  }

  /**
   * 调用AI模型生成响应
   * @param {Object} options 配置选项
   * @param {string} options.model 模型名称，必须传入
   * @param {Array} options.messages 消息数组，包含角色和内容
   * @param {number} options.temperature 温度参数，控制生成的随机性，默认为0.7
   * @param {boolean} options.stream 是否流式传输，默认为false
   * @param {number} options.max_tokens 最大token数量，默认为2000
   * @returns {Promise<string|AsyncIterable>} 返回生成的文本或流
   */
  async generateResponse(options = {}) {
    try {
      const {
        model,  // 必须由调用方传入
        messages = [],
        temperature,  // 必须由调用方传入
        stream = false,
        max_tokens,   // 必须由调用方传入
        baseURL,  // 必须由调用方传入
        apiKeyEnv  // 可选，指定使用的API Key环境变量名
      } = options;

      // 验证必需参数
      if (!model) {
        throw new Error('模型名称(model)是必需参数');
      }

      if (!messages || messages.length === 0) {
        throw new Error('消息数组不能为空');
      }

      if (temperature === undefined || temperature === null) {
        throw new Error('温度参数(temperature)是必需参数');
      }

      if (!max_tokens) {
        throw new Error('最大token数(max_tokens)是必需参数');
      }

      if (!baseURL) {
        throw new Error('AI服务地址(baseURL)是必需参数');
      }

      // 根据apiKeyEnv参数选择合适的API Key
      let apiKey;
      console.log(`[AI服务] API Key环境变量参数: ${apiKeyEnv}`);
      if (apiKeyEnv) {
        console.log(`[AI服务] 尝试从环境变量 ${apiKeyEnv} 获取API Key`);
        apiKey = process.env[apiKeyEnv];
        console.log(`[AI服务] 环境变量 ${apiKeyEnv} 的值: ${apiKey ? '已设置(长度:' + apiKey.length + ')' : '未设置或为空'}`);
        if (!apiKey) {
          throw new Error(`AI API Key未设置，请检查环境变量${apiKeyEnv}`);
        }
        console.log(`[AI服务] 使用自定义API Key环境变量: ${apiKeyEnv}`);
      } else {
        console.log('[AI服务] 使用默认API Key');
        apiKey = this.defaultApiKey;
        if (!apiKey) {
          throw new Error('AI API Key未设置，请检查环境变量TENCENT_AI_API_KEY');
        }
      }

      console.log(`[AI服务] 调用模型: ${model}, 温度: ${temperature}, 流式: ${stream}, baseURL: ${baseURL}`);
      
      // 动态创建OpenAI客户端，设置超时时间
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        timeout: 120000, // 120秒超时，DeepSeek推理模型需要更长时间
        maxRetries: 1   // 最多重试1次
      });
      
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature,
        stream,
        max_tokens
      });

      if (stream) {
        // 返回流对象
        return completion;
      } else {
        // 返回完整响应
        return completion.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('[AI服务] 生成响应失败:', error);
      throw new Error(`AI服务调用失败: ${error.message}`);
    }
  }

  /**
   * 通用AI对话接口
   * @param {Array} messages 对话消息数组
   * @param {Object} options 配置选项
   * @param {string} options.model 模型名称，必须传入
   * @param {number} options.temperature 温度参数
   * @param {boolean} options.stream 是否流式传输
   * @param {number} options.max_tokens 最大token数量
   * @returns {Promise<string|AsyncIterable>} AI回复或流
   */
  async chat(messages, options = {}) {
    try {
      const {
        model,  // 必须由调用方传入
        temperature,  // 必须由调用方传入
        stream = false,
        max_tokens,  // 必须由调用方传入
        baseURL,  // 必须由调用方传入
        apiKeyEnv  // 可选，指定使用的API Key环境变量名
      } = options;

      if (!model) {
        throw new Error('模型名称(model)是必需参数');
      }

      if (temperature === undefined || temperature === null) {
        throw new Error('温度参数(temperature)是必需参数');
      }

      if (!max_tokens) {
        throw new Error('最大token数(max_tokens)是必需参数');
      }

      if (!baseURL) {
        throw new Error('AI服务地址(baseURL)是必需参数');
      }

      console.log('[AI服务] 开始AI对话, 模型:', model);
      
      return await this.generateResponse({
        model,
        messages,
        temperature,
        stream,
        max_tokens,
        baseURL,
        apiKeyEnv
      });
    } catch (error) {
      console.error('[AI服务] AI对话失败:', error);
      throw error;
    }
  }

  /**
   * 流式AI对话接口
   * @param {Array} messages 对话消息数组
   * @param {Object} options 配置选项
   * @returns {Promise<AsyncIterable>} 流式响应
   */
  async chatStream(messages, options = {}) {
    return this.chat(messages, { ...options, stream: true });
  }

  /**
   * 构建AI请求消息
   * @param {string} systemPrompt 系统提示词
   * @param {string} userPrompt 用户提示词
   * @param {Array} conversationHistory 对话历史（可选）
   * @returns {Array} 格式化的消息数组
   */
  buildMessages(systemPrompt, userPrompt, conversationHistory = []) {
    const messages = [];

    // 添加系统提示词
    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt
      });
    }

    // 添加对话历史
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // 添加用户提示词
    if (userPrompt) {
      messages.push({
        role: "user",
        content: userPrompt
      });
    }

    return messages;
  }

  /**
   * 通用的业务场景AI调用
   * @param {Object} params 参数对象
   * @param {string} params.systemPrompt 系统提示词
   * @param {string} params.userPrompt 用户提示词
   * @param {string} params.model 模型名称
   * @param {Object} params.options AI调用选项
   * @param {Array} params.conversationHistory 对话历史
   * @param {string} params.baseURL 可选的AI服务baseURL
   * @returns {Promise<string>} AI响应
   */
  async processBusinessRequest(params) {
    try {
      const {
        systemPrompt,
        userPrompt,
        model,
        options = {},
        conversationHistory = [],
        baseURL,
        apiKeyEnv
      } = params;

      // 验证必需参数
      if (!model) {
        throw new Error('模型名称(model)是必需参数');
      }

      if (!systemPrompt && !userPrompt) {
        throw new Error('系统提示词或用户提示词至少需要提供一个');
      }

      console.log(`[AI服务] 处理业务请求, 模型: ${model}`);

      // 构建消息
      const messages = this.buildMessages(systemPrompt, userPrompt, conversationHistory);

      // 调用AI服务（支持动态baseURL和apiKeyEnv）
      const chatOptions = { model, ...options };
      if (baseURL) {
        chatOptions.baseURL = baseURL;
        console.log('[AI服务] 使用自定义baseURL:', baseURL);
      }
      if (apiKeyEnv) {
        chatOptions.apiKeyEnv = apiKeyEnv;
        console.log('[AI服务] 使用自定义API Key环境变量:', apiKeyEnv);
      }
      
      const response = await this.chat(messages, chatOptions);

      console.log('[AI服务] 业务请求处理完成');
      return response;
    } catch (error) {
      console.error('[AI服务] 业务请求处理失败:', error);
      throw error;
    }
  }

  /**
   * 流式业务场景AI调用
   * @param {Object} params 参数对象
   * @returns {Promise<AsyncIterable>} 流式响应
   */
  async processBusinessRequestStream(params) {
    try {
      const {
        systemPrompt,
        userPrompt,
        model,
        options = {},
        conversationHistory = [],
        baseURL,
        apiKeyEnv
      } = params;

      // 验证必需参数
      if (!model) {
        throw new Error('模型名称(model)是必需参数');
      }

      console.log(`[AI服务] 处理流式业务请求, 模型: ${model}`);

      // 构建消息
      const messages = this.buildMessages(systemPrompt, userPrompt, conversationHistory);

      // 调用流式AI服务
      const chatOptions = { model, ...options };
      if (baseURL) {
        chatOptions.baseURL = baseURL;
      }
      if (apiKeyEnv) {
        chatOptions.apiKeyEnv = apiKeyEnv;
      }
      return await this.chatStream(messages, chatOptions);
    } catch (error) {
      console.error('[AI服务] 流式业务请求处理失败:', error);
      throw error;
    }
  }

  /**
   * 检查AI服务是否可用
   * @param {string} model 要测试的模型名称（必需）
   * @param {string} baseURL AI服务地址（必需）
   * @param {number} temperature 测试用温度值（默认0.1）
   * @param {number} max_tokens 测试用最大token数（默认10）
   * @returns {Promise<boolean>} 服务是否可用
   */
  async isServiceAvailable(model, baseURL, temperature = 0.1, max_tokens = 10, apiKeyEnv = null) {
    try {
      if (!model) {
        throw new Error('模型名称(model)是必需参数');
      }

      if (!baseURL) {
        throw new Error('AI服务地址(baseURL)是必需参数');
      }

      // 根据apiKeyEnv参数选择合适的API Key
      let apiKey;
      if (apiKeyEnv) {
        apiKey = process.env[apiKeyEnv];
        if (!apiKey) {
          return false;
        }
      } else {
        apiKey = this.defaultApiKey;
        if (!apiKey) {
          return false;
        }
      }

      // 发送测试请求
      const testResponse = await this.generateResponse({
        model: model,
        messages: [{ role: "user", content: "测试连接" }],
        temperature,
        max_tokens,
        baseURL,
        apiKeyEnv
      });

      return typeof testResponse === 'string' && testResponse.length > 0;
    } catch (error) {
      console.error('[AI服务] 服务可用性检查失败:', error);
      return false;
    }
  }

  /**
   * 获取支持的模型列表（可扩展）
   * @returns {Array} 支持的模型列表
   */
  getSupportedModels() {
    return [
      {
        id: 'deepseek-v3',
        name: 'DeepSeek V3',
        description: '深度求索最新模型，擅长推理和代码生成',
        maxTokens: 4096,
        supportStream: true,
        provider: 'DeepSeek'
      }
      // 可以根据腾讯云AI服务支持的模型扩展
      // {
      //   id: 'gpt-4',
      //   name: 'GPT-4',
      //   description: 'OpenAI最先进的模型',
      //   maxTokens: 8192,
      //   supportStream: true,
      //   provider: 'OpenAI'
      // }
    ];
  }

  /**
   * 验证模型是否支持
   * @param {string} modelId 模型ID
   * @returns {boolean} 是否支持该模型
   */
  isModelSupported(modelId) {
    const supportedModels = this.getSupportedModels();
    return supportedModels.some(model => model.id === modelId);
  }

  /**
   * 获取模型信息
   * @param {string} modelId 模型ID
   * @returns {Object|null} 模型信息
   */
  getModelInfo(modelId) {
    const supportedModels = this.getSupportedModels();
    return supportedModels.find(model => model.id === modelId) || null;
  }

  /**
   * 获取OpenAI实例
   * @param {string} baseURL API基础URL
   * @param {string} apiKeyEnv API Key环境变量名
   * @returns {OpenAI} OpenAI实例
   */
  getOpenAIInstance(baseURL, apiKeyEnv) {
    // 获取API Key
    let apiKey;
    if (apiKeyEnv) {
      apiKey = process.env[apiKeyEnv];
      console.log(`[AI服务] 使用指定的API Key环境变量: ${apiKeyEnv}`);
      if (!apiKey) {
        throw new Error(`API Key环境变量 ${apiKeyEnv} 未设置`);
      }
    } else {
      console.log('[AI服务] 使用默认API Key');
      apiKey = this.defaultApiKey;
      if (!apiKey) {
        throw new Error('AI API Key未设置，请检查环境变量TENCENT_AI_API_KEY');
      }
    }

    // 创建OpenAI客户端
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL || this.defaultBaseURL,
      timeout: 120000, // 120秒超时
      maxRetries: 1   // 最多重试1次
    });

    return client;
  }

  /**
   * 生成图像
   * @param {Object} options 图像生成选项
   * @param {string} options.prompt 图像描述
   * @param {string} options.model 模型名称
   * @param {string} [options.size] 图像尺寸，默认 "1024x1024"
   * @param {number} [options.n] 生成图像数量，默认 1
   * @param {string} [options.response_format] 返回格式，默认 "url"
   * @param {number} [options.seed] 随机种子，默认 -1
   * @param {number} [options.guidance_scale] 引导强度，默认 2.5
   * @param {boolean} [options.watermark] 是否添加水印，默认 true
   * @param {string} [options.baseURL] API基础URL
   * @param {string} [options.apiKeyEnv] API Key环境变量名
   * @param {string} [options.apiKey] 直接传入的API密钥
   * @returns {Promise<Object>} 生成结果
   */
  async generateImage(options) {
    const {
      prompt,
      model,
      size = "1024x1024",
      n = 1,
      response_format = "url",
      seed = -1,
      guidance_scale = 2.5,
      watermark = false,
      baseURL,
      apiKeyEnv,
      apiKey
    } = options;

    if (!prompt || !model) {
      throw new Error('缺少必要参数：prompt 和 model');
    }

    try {
      console.log('[AI服务] 开始图像生成:', {
        model,
        prompt: prompt.substring(0, 50) + '...',
        size,
        response_format,
        seed,
        guidance_scale,
        watermark,
        baseURL,
        hasApiKey: !!(apiKey || apiKeyEnv)
      });

      // 获取API密钥
      let finalApiKey;
      if (apiKey) {
        // 直接使用传入的API密钥
        finalApiKey = apiKey;
        console.log('[AI服务] 使用直接传入的API密钥');
      } else if (apiKeyEnv) {
        // 从环境变量获取
        finalApiKey = process.env[apiKeyEnv];
        console.log(`[AI服务] 使用环境变量 ${apiKeyEnv} 的API密钥`);
        if (!finalApiKey) {
          throw new Error(`API Key环境变量 ${apiKeyEnv} 未设置`);
        }
      } else {
        // 使用默认API密钥
        finalApiKey = this.defaultApiKey;
        console.log('[AI服务] 使用默认API密钥');
        if (!finalApiKey) {
          throw new Error('AI API Key未设置，请检查环境变量TENCENT_AI_API_KEY或直接传入apiKey');
        }
      }

      // 创建OpenAI客户端
      const openai = new OpenAI({
        apiKey: finalApiKey,
        baseURL: baseURL || this.defaultBaseURL,
        timeout: 120000, // 120秒超时
        maxRetries: 1   // 最多重试1次
      });

      // 构建请求参数
      const requestParams = {
        model: model,
        prompt: prompt,
        size: size,
        n: n,
        response_format: response_format
      };

      // 添加可选参数
      if (seed !== -1) {
        requestParams.seed = seed;
      }

      if (guidance_scale !== 2.5) {
        requestParams.guidance_scale = guidance_scale;
      }

      if (watermark !== undefined) {
        requestParams.watermark = watermark;
      }

      console.log('[AI服务] 图像生成请求参数:', requestParams);

      // 调用图像生成API
      const response = await openai.images.generate(requestParams);

      console.log('[AI服务] 图像生成成功:', {
        dataLength: response.data?.length || 0,
        hasUrl: !!(response.data?.[0]?.url),
        hasB64: !!(response.data?.[0]?.b64_json)
      });

      return response;
    } catch (error) {
      console.error('[AI服务] 图像生成失败:', error);
      throw new Error(`图像生成失败: ${error.message}`);
    }
  }
}

module.exports = new AIService(); 