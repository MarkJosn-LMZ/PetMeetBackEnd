/**
 * 保存AI模型配置到数据库脚本
 * 将项目中使用的所有AI模型配置保存到AI_Model集合中
 * 
 * 使用方法：
 * 1. 确保环境变量已设置（API Keys）
 * 2. 运行命令：node scripts/save-ai-models-to-db.js
 */

require('dotenv').config();
const { getDatabase } = require('../config/cloudbaseConfig');

// 清理和验证API Key的函数
function getApiKey(envVarName) {
    const apiKey = process.env[envVarName];
    if (!apiKey) {
        console.warn(`⚠️  环境变量 ${envVarName} 未设置`);
        return null;
    }
    console.log(`✅ 环境变量 ${envVarName} 已设置 (长度: ${apiKey.length})`);
    return apiKey;
}

// 定义所有AI模型配置
const aiModelsConfig = [
    // 文字模型配置
    {
        name: 'DeepSeek-R1-腾讯代理',
        type: 'text',
        model: 'deepseek-r1',
        provider: 'deepseek-tencent',
        apiKey: getApiKey('TENCENT_AI_API_KEY'),
        baseURL: 'https://cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com/v1/ai/deepseek/v1',
        description: 'DeepSeek-R1模型通过腾讯云代理访问，支持思维链推理',
        config: {
            temperature: 0.7,
            max_tokens: 4000,
            supportsStreaming: true,
            supportsThinking: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DeepSeek-R1-原生',
        type: 'text',
        model: 'deepseek-reasoner',
        provider: 'deepseek-native',
        apiKey: getApiKey('DEEP_SEEK_API_KEY'),
        baseURL: 'https://api.deepseek.com/v1',
        description: 'DeepSeek-R1模型原生API访问，推理能力强',
        config: {
            temperature: 0.7,
            max_tokens: 4000,
            supportsStreaming: true,
            supportsThinking: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DeepSeek-V3',
        type: 'text',
        model: 'deepseek-reasoner',
        provider: 'deepseek-native',
        apiKey: getApiKey('DEEP_SEEK_API_KEY'),
        baseURL: 'https://api.deepseek.com/v1',
        description: 'DeepSeek-V3模型，强大的多语言编程能力',
        config: {
            temperature: 0.7,
            max_tokens: 2000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: '腾讯混元',
        type: 'text',
        model: 'hunyuan-turbos-latest',
        provider: 'hunyuan-exp',
        apiKey: getApiKey('TENCENT_AI_API_KEY'),
        baseURL: 'https://cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com/v1/ai/hunyuan-exp/v1',
        description: '腾讯混元大模型，中文理解能力优秀',
        config: {
            temperature: 0.7,
            max_tokens: 2000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DouBao-1.5-思维版',
        type: 'text',
        model: 'doubao-1-5-thinking-pro-250415',
        provider: 'DouBao',
        apiKey: getApiKey('DOU_BAO_API_KEY'),
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        description: '豆包1.5思维版本，支持逐步推理',
        config: {
            temperature: 0.7,
            max_tokens: 2000,
            supportsStreaming: true,
            supportsThinking: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DouBao-Pro-32K',
        type: 'text',
        model: 'doubao-pro-32k',
        provider: 'DouBao',
        apiKey: getApiKey('DOU_BAO_API_KEY'),
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        description: '豆包Pro版本，支持32K上下文',
        config: {
            temperature: 0.7,
            max_tokens: 1000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DouBao-Pro-128K',
        type: 'text',
        model: 'doubao-pro-128k',
        provider: 'DouBao',
        apiKey: getApiKey('DOU_BAO_API_KEY'),
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        description: '豆包Pro版本，支持128K超长上下文',
        config: {
            temperature: 0.7,
            max_tokens: 1000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DouBao-Lite-32K',
        type: 'text',
        model: 'doubao-lite-32k',
        provider: 'DouBao',
        apiKey: getApiKey('DOU_BAO_API_KEY'),
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        description: '豆包Lite版本，轻量级32K上下文',
        config: {
            temperature: 0.7,
            max_tokens: 1000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DouBao-Lite-128K',
        type: 'text',
        model: 'doubao-lite-128k',
        provider: 'DouBao',
        apiKey: getApiKey('DOU_BAO_API_KEY'),
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        description: '豆包Lite版本，轻量级128K上下文',
        config: {
            temperature: 0.7,
            max_tokens: 1000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DeepSeek-Chat',
        type: 'text',
        model: 'deepseek-chat',
        provider: 'deepseek-native',
        apiKey: getApiKey('DEEP_SEEK_API_KEY'),
        baseURL: 'https://api.deepseek.com/v1',
        description: 'DeepSeek聊天模型，适合对话场景',
        config: {
            temperature: 0.7,
            max_tokens: 1000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DeepSeek-Coder',
        type: 'text',
        model: 'deepseek-coder',
        provider: 'deepseek-native',
        apiKey: getApiKey('DEEP_SEEK_API_KEY'),
        baseURL: 'https://api.deepseek.com/v1',
        description: 'DeepSeek代码模型，专门优化编程任务',
        config: {
            temperature: 0.7,
            max_tokens: 1000,
            supportsStreaming: true,
            supportsThinking: false
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // 图像模型配置
    {
        name: 'DouBao-SeeDream-图像生成',
        type: 'image',
        model: 'doubao-seedream-3-0-t2i-250415',
        provider: 'DouBao',
        apiKey: getApiKey('DOU_BAO_API_KEY'),
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        description: '豆包SeeDream 3.0文生图模型，支持多种尺寸和风格',
        config: {
            response_format: 'url',
            size: '1024x1024',
            seed: -1,
            guidance_scale: 2.5,
            watermark: true,
            supportedSizes: [
                '1024x1024', '864x1152', '1152x864', 
                '1280x720', '720x1280', '832x1248', 
                '1248x832', '1512x648'
            ]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DALL-E-3',
        type: 'image',
        model: 'dall-e-3',
        provider: 'OpenAI',
        apiKey: getApiKey('DEEP_SEEK_API_KEY'), // 某些代理可能通过DeepSeek访问
        baseURL: 'https://api.deepseek.com/v1',
        description: 'OpenAI DALL-E 3图像生成模型，高质量艺术创作',
        config: {
            response_format: 'url',
            size: '1024x1024',
            quality: 'standard',
            style: 'vivid',
            supportedSizes: ['1024x1024', '1024x1792', '1792x1024']
        },
        isActive: false, // 默认不激活，需要确认可用性
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'DALL-E-2',
        type: 'image',
        model: 'dall-e-2',
        provider: 'OpenAI',
        apiKey: getApiKey('DEEP_SEEK_API_KEY'),
        baseURL: 'https://api.deepseek.com/v1',
        description: 'OpenAI DALL-E 2图像生成模型，经典版本',
        config: {
            response_format: 'url',
            size: '1024x1024',
            supportedSizes: ['256x256', '512x512', '1024x1024']
        },
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: '腾讯图像生成模型',
        type: 'image',
        model: 'tencent-image-model',
        provider: 'Tencent',
        apiKey: getApiKey('TENCENT_AI_API_KEY'),
        baseURL: 'https://cloud1-9g9n1il77a00ffbc.api.tcloudbasegateway.com/v1/ai/image/v1',
        description: '腾讯自研图像生成模型',
        config: {
            response_format: 'url',
            size: '1024x1024'
        },
        isActive: false, // 需要确认可用性
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

async function saveAIModelsToDatabase() {
    console.log('🚀 开始将AI模型配置保存到数据库...\n');

    try {
        // 获取数据库实例
        const db = getDatabase();
        const collection = db.collection('AI_Model');

        console.log('📊 检查当前环境变量状态:');
        console.log(`   TENCENT_AI_API_KEY: ${process.env.TENCENT_AI_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
        console.log(`   DEEP_SEEK_API_KEY: ${process.env.DEEP_SEEK_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
        console.log(`   DOU_BAO_API_KEY: ${process.env.DOU_BAO_API_KEY ? '✅ 已设置' : '❌ 未设置'}\n`);

        // 清空现有的AI模型配置（可选）
        console.log('🗑️  清空现有AI模型配置...');
        try {
            const deleteResult = await collection.where({}).remove();
            console.log(`   删除了 ${deleteResult.deleted} 条现有记录\n`);
        } catch (error) {
            console.log('   集合可能不存在，继续执行...\n');
        }

        // 分别统计文字模型和图像模型
        const textModels = aiModelsConfig.filter(model => model.type === 'text');
        const imageModels = aiModelsConfig.filter(model => model.type === 'image');

        console.log(`📝 准备保存 ${textModels.length} 个文字模型：`);
        textModels.forEach(model => {
            const status = model.apiKey ? '✅' : '❌';
            console.log(`   ${status} ${model.name} (${model.model})`);
        });

        console.log(`\n🎨 准备保存 ${imageModels.length} 个图像模型：`);
        imageModels.forEach(model => {
            const status = model.apiKey ? '✅' : '❌';
            console.log(`   ${status} ${model.name} (${model.model})`);
        });

        console.log('\n💾 开始批量保存到数据库...');

        // 批量插入所有模型配置
        let successCount = 0;
        let errorCount = 0;

        for (const modelConfig of aiModelsConfig) {
            try {
                // 为每个模型生成唯一的文档ID
                const docId = `${modelConfig.type}_${modelConfig.provider}_${modelConfig.model}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                
                await collection.doc(docId).set(modelConfig);
                successCount++;
                
                const keyStatus = modelConfig.apiKey ? '🔑' : '🚫';
                console.log(`   ✅ ${modelConfig.name} ${keyStatus}`);
            } catch (error) {
                errorCount++;
                console.error(`   ❌ ${modelConfig.name}: ${error.message}`);
            }
        }

        console.log(`\n📈 保存结果统计:`);
        console.log(`   ✅ 成功保存: ${successCount} 个模型`);
        console.log(`   ❌ 保存失败: ${errorCount} 个模型`);
        console.log(`   📊 总计: ${aiModelsConfig.length} 个模型配置`);

        // 验证保存结果
        console.log('\n🔍 验证数据库中的模型配置...');
        const { data: savedModels } = await collection.get();
        
        const savedTextModels = savedModels.filter(model => model.type === 'text');
        const savedImageModels = savedModels.filter(model => model.type === 'image');
        const activeModels = savedModels.filter(model => model.isActive);

        console.log(`   📝 文字模型: ${savedTextModels.length} 个`);
        console.log(`   🎨 图像模型: ${savedImageModels.length} 个`);
        console.log(`   ✅ 激活模型: ${activeModels.length} 个`);
        console.log(`   🔑 有效密钥: ${savedModels.filter(model => model.apiKey).length} 个`);

        console.log('\n🎉 AI模型配置保存完成！');
        console.log('\n💡 下一步操作建议:');
        console.log('   1. 在前后端代码中从数据库加载模型配置');
        console.log('   2. 移除硬编码的模型配置');
        console.log('   3. 实现模型配置的动态管理功能');
        console.log('   4. 定期检查和更新API密钥状态');

        // 显示一些示例查询
        console.log('\n📋 数据库查询示例:');
        console.log('   获取所有激活的文字模型:');
        console.log('   db.collection("AI_Model").where({type: "text", isActive: true}).get()');
        console.log('\n   获取特定提供商的模型:');
        console.log('   db.collection("AI_Model").where({provider: "DouBao"}).get()');

    } catch (error) {
        console.error('❌ 保存AI模型配置时发生错误:', error);
        console.error('错误详情:', error.stack);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    saveAIModelsToDatabase()
        .then(() => {
            console.log('\n✨ 脚本执行完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = {
    saveAIModelsToDatabase,
    aiModelsConfig
}; 