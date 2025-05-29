const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { authenticateToken } = require('../middleware/authMiddleware');

// 所有路由都需要身份验证
router.use(authenticateToken);

/**
 * 通用AI处理接口 - 非流式
 * POST /api/ai/process
 * 前端完全控制所有参数：baseURL、模型、提示词、temperature、max_tokens等
 */
router.post('/process', async (req, res) => {
  try {
    const { 
      systemPrompt, 
      userPrompt, 
      model, 
      options = {},
      conversationHistory = [],
      baseURL,  // 支持前端传入不同的AI服务URL
      apiKeyEnv // 支持前端传入不同的API Key环境变量
    } = req.body;

    // 验证必需参数
    if (!model) {
      return res.status(400).json({
        success: false,
        message: '模型名称不能为空'
      });
    }

    if (!systemPrompt && !userPrompt) {
      return res.status(400).json({
        success: false,
        message: '系统提示词或用户提示词至少需要提供一个'
      });
    }

    console.log('[AI路由] 收到通用AI请求:', { 
      model, 
      hasSystemPrompt: !!systemPrompt,
      hasUserPrompt: !!userPrompt,
      historyLength: conversationHistory.length,
      options: options,
      baseURL: baseURL || '默认',
      apiKeyEnv: apiKeyEnv || '默认'
    });
    
    console.log('[AI路由] 系统提示词:', systemPrompt);
    console.log('[AI路由] 用户提示词:', userPrompt);

    // 如果前端传入了baseURL，临时设置AI服务的baseURL
    if (baseURL) {
      console.log('[AI路由] 使用前端指定的baseURL:', baseURL);
      // 这里可以根据需要动态设置不同的AI服务
    }

    // 调用AI服务进行处理
    let response = await aiService.processBusinessRequest({
      systemPrompt,
      userPrompt,
      model,
      options,
      conversationHistory,
      baseURL,
      apiKeyEnv
    });

    res.json({
      success: true,
      message: 'AI处理完成',
      data: {
        response: response,
        timestamp: new Date().toISOString(),
        model: model,
        options: options
      }
    });

  } catch (error) {
    console.error('[AI路由] 通用AI请求错误:', error);
    res.status(500).json({
      success: false,
      message: 'AI处理失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 通用AI处理接口 - 流式
 * POST /api/ai/process-stream
 */
router.post('/process-stream', async (req, res) => {
  try {
    const { 
      systemPrompt, 
      userPrompt, 
      model, 
      options = {},
      conversationHistory = [],
      baseURL,
      apiKeyEnv
    } = req.body;

    // 验证必需参数
    if (!model) {
      return res.status(400).json({
        success: false,
        message: '模型名称不能为空'
      });
    }

    if (!systemPrompt && !userPrompt) {
      return res.status(400).json({
        success: false,
        message: '系统提示词或用户提示词至少需要提供一个'
      });
    }

    console.log('[AI路由] 收到流式AI请求:', { 
      model,
      hasSystemPrompt: !!systemPrompt,
      hasUserPrompt: !!userPrompt,
      options: options,
      baseURL: baseURL || '默认',
      apiKeyEnv: apiKeyEnv || '默认'
    });

    // 设置流式响应头
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 调用流式AI服务
    const stream = await aiService.processBusinessRequestStream({
      systemPrompt,
      userPrompt,
      model,
      options,
      conversationHistory,
      baseURL,
      apiKeyEnv
    });

    // 处理流式响应
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        const content = chunk.choices[0].delta.content;
        if (content) {
          res.write(content);
        }
      }
    }

    res.end();

  } catch (error) {
    console.error('[AI路由] 流式AI请求错误:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'AI流式处理失败',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

/**
 * 检查AI服务状态
 * GET /api/ai/status
 */
router.get('/status', async (req, res) => {
  try {
    const { model, baseURL } = req.query;
    
    // 从请求头获取API Key环境变量名
    const apiKeyEnv = req.headers['x-api-key-env'];
    
    // 验证必需参数
    if (!model) {
      return res.status(400).json({
        success: false,
        message: '模型名称不能为空'
      });
    }
    
    console.log('[AI路由] 检查AI服务状态, 模型:', model, 'baseURL:', baseURL, 'apiKeyEnv:', apiKeyEnv);
    
    // 验证baseURL参数
    if (!baseURL) {
      return res.status(400).json({
        success: false,
        message: 'AI服务地址(baseURL)不能为空'
      });
    }

    // 传递apiKeyEnv参数给服务层
    const isAvailable = await aiService.isServiceAvailable(model, baseURL, 0.1, 10, apiKeyEnv);
    
    res.json({
      success: true,
      message: '服务状态检查完成',
      data: {
        available: isAvailable,
        model: model,
        baseURL: baseURL || '默认',
        apiKeyEnv: apiKeyEnv || '默认',
        timestamp: new Date().toISOString(),
        service: 'Universal AI Service'
      }
    });

  } catch (error) {
    console.error('[AI路由] 服务状态检查错误:', error);
    res.status(500).json({
      success: false,
      message: '服务状态检查失败',
      data: {
        available: false,
        timestamp: new Date().toISOString()
      },
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 获取支持的AI模型列表（前端可扩展）
 * GET /api/ai/models
 */
router.get('/models', (req, res) => {
  try {
    // 返回通用模型格式，前端可以传入任何模型
    const modelTemplate = {
      supported: [
        'deepseek-v3',
        'gpt-4',
        'gpt-3.5-turbo',
        'claude-3',
        // 前端可以传入任何其他模型
      ],
      note: '此接口支持任何模型，前端可传入任意model参数'
    };

    res.json({
      success: true,
      message: '获取模型信息成功',
      data: {
        ...modelTemplate,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[AI路由] 获取模型列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取模型列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * AI图像生成接口
 * POST /api/ai/image
 */
router.post('/image', async (req, res) => {
  try {
    const {
      model,
      prompt,
      size = "1024x1024",
      n = 1,
      response_format = "url",
      seed = -1,
      guidance_scale = 2.5,
      watermark = false,
      baseURL,
      apiKeyEnv
    } = req.body;

    // 参数验证
    if (!model || !prompt) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：model 和 prompt'
      });
    }

    console.log('[AI路由] 图像生成请求:', {
      model,
      prompt: prompt.substring(0, 50) + '...',
      size,
      response_format,
      seed,
      guidance_scale,
      watermark,
      baseURL,
      apiKeyEnv,
      userId: req.user?.userId
    });

    // 调用AI服务生成图像
    const result = await aiService.generateImage({
      model,
      prompt,
      size,
      n,
      response_format,
      seed,
      guidance_scale,
      watermark,
      baseURL,
      apiKeyEnv
    });

    console.log('[AI路由] 图像生成成功');

    res.json({
      success: true,
      data: result,
      message: '图像生成成功'
    });

  } catch (error) {
    console.error('[AI路由] 图像生成失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '图像生成失败'
    });
  }
});

module.exports = router; 