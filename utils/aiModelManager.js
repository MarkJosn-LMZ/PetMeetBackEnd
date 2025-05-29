/**
 * AI模型管理工具
 * 用于从数据库加载和管理AI模型配置
 * 替代硬编码的模型配置，实现动态模型管理
 */

const { getDatabase } = require('../config/cloudbaseConfig');

class AIModelManager {
    constructor() {
        this.cache = new Map(); // 缓存已加载的模型配置
        this.cacheTime = 5 * 60 * 1000; // 缓存5分钟
        this.lastCacheUpdate = 0;
    }

    /**
     * 获取所有AI模型配置
     * @param {boolean} forceRefresh 是否强制刷新缓存
     * @returns {Promise<Array>} 模型配置数组
     */
    async getAllModels(forceRefresh = false) {
        const cacheKey = 'all_models';
        
        // 检查缓存
        if (!forceRefresh && this.isCacheValid(cacheKey)) {
            console.log('[AI模型管理] 使用缓存的模型配置');
            return this.cache.get(cacheKey);
        }

        try {
            const db = getDatabase();
            const { data: models } = await db.collection('AI_Model').get();
            
            console.log(`[AI模型管理] 从数据库加载了 ${models.length} 个模型配置`);
            
            // 更新缓存
            this.cache.set(cacheKey, models);
            this.lastCacheUpdate = Date.now();
            
            return models;
        } catch (error) {
            console.error('[AI模型管理] 加载模型配置失败:', error);
            
            // 如果有缓存，返回缓存数据
            if (this.cache.has(cacheKey)) {
                console.log('[AI模型管理] 数据库访问失败，使用缓存数据');
                return this.cache.get(cacheKey);
            }
            
            throw new Error('无法加载AI模型配置: ' + error.message);
        }
    }

    /**
     * 获取文字模型配置
     * @param {boolean} activeOnly 是否只返回激活的模型
     * @returns {Promise<Array>} 文字模型配置数组
     */
    async getTextModels(activeOnly = true) {
        const allModels = await this.getAllModels();
        return allModels.filter(model => 
            model.type === 'text' && 
            (!activeOnly || model.isActive) &&
            model.apiKey // 只返回有API密钥的模型
        );
    }

    /**
     * 获取图像模型配置
     * @param {boolean} activeOnly 是否只返回激活的模型
     * @returns {Promise<Array>} 图像模型配置数组
     */
    async getImageModels(activeOnly = true) {
        const allModels = await this.getAllModels();
        return allModels.filter(model => 
            model.type === 'image' && 
            (!activeOnly || model.isActive) &&
            model.apiKey // 只返回有API密钥的模型
        );
    }

    /**
     * 根据提供商获取模型
     * @param {string} provider 提供商名称
     * @param {string} type 模型类型 ('text' | 'image')
     * @returns {Promise<Array>} 模型配置数组
     */
    async getModelsByProvider(provider, type = null) {
        const allModels = await this.getAllModels();
        return allModels.filter(model => 
            model.provider === provider && 
            (!type || model.type === type) &&
            model.apiKey
        );
    }

    /**
     * 根据模型名称获取特定模型配置
     * @param {string} modelName 模型名称
     * @returns {Promise<Object|null>} 模型配置对象
     */
    async getModelByName(modelName) {
        const allModels = await this.getAllModels();
        return allModels.find(model => 
            model.model === modelName && 
            model.apiKey
        ) || null;
    }

    /**
     * 根据模型ID获取特定模型配置
     * @param {string} modelId 模型文档ID
     * @returns {Promise<Object|null>} 模型配置对象
     */
    async getModelById(modelId) {
        try {
            const db = getDatabase();
            const { data } = await db.collection('AI_Model').doc(modelId).get();
            return data || null;
        } catch (error) {
            console.error(`[AI模型管理] 获取模型 ${modelId} 失败:`, error);
            return null;
        }
    }

    /**
     * 获取默认的文字模型
     * @returns {Promise<Object|null>} 默认文字模型配置
     */
    async getDefaultTextModel() {
        const textModels = await this.getTextModels();
        
        // 优先级：DeepSeek-R1 > 腾讯混元 > 豆包思维版 > 其他
        const priorities = [
            'deepseek-r1',
            'hunyuan-turbos-latest', 
            'doubao-1-5-thinking-pro-250415',
            'deepseek-reasoner',
            'doubao-pro-32k'
        ];

        for (const modelName of priorities) {
            const model = textModels.find(m => m.model === modelName);
            if (model) {
                console.log(`[AI模型管理] 使用默认文字模型: ${model.name}`);
                return model;
            }
        }

        // 如果没有匹配的优先模型，返回第一个可用的
        if (textModels.length > 0) {
            console.log(`[AI模型管理] 使用第一个可用文字模型: ${textModels[0].name}`);
            return textModels[0];
        }

        console.warn('[AI模型管理] 没有可用的文字模型');
        return null;
    }

    /**
     * 获取默认的图像模型
     * @returns {Promise<Object|null>} 默认图像模型配置
     */
    async getDefaultImageModel() {
        const imageModels = await this.getImageModels();
        
        // 优先使用豆包SeeDream模型
        const defaultModel = imageModels.find(m => 
            m.model === 'doubao-seedream-3-0-t2i-250415'
        );

        if (defaultModel) {
            console.log(`[AI模型管理] 使用默认图像模型: ${defaultModel.name}`);
            return defaultModel;
        }

        // 如果没有豆包模型，返回第一个可用的
        if (imageModels.length > 0) {
            console.log(`[AI模型管理] 使用第一个可用图像模型: ${imageModels[0].name}`);
            return imageModels[0];
        }

        console.warn('[AI模型管理] 没有可用的图像模型');
        return null;
    }

    /**
     * 更新模型配置
     * @param {string} modelId 模型文档ID
     * @param {Object} updates 要更新的字段
     * @returns {Promise<boolean>} 更新是否成功
     */
    async updateModel(modelId, updates) {
        try {
            const db = getDatabase();
            await db.collection('AI_Model').doc(modelId).update({
                ...updates,
                updatedAt: new Date()
            });
            
            // 清除缓存，强制下次重新加载
            this.clearCache();
            
            console.log(`[AI模型管理] 模型 ${modelId} 更新成功`);
            return true;
        } catch (error) {
            console.error(`[AI模型管理] 更新模型 ${modelId} 失败:`, error);
            return false;
        }
    }

    /**
     * 激活/停用模型
     * @param {string} modelId 模型文档ID
     * @param {boolean} isActive 是否激活
     * @returns {Promise<boolean>} 操作是否成功
     */
    async setModelActive(modelId, isActive) {
        return this.updateModel(modelId, { isActive });
    }

    /**
     * 检查模型是否可用（有API密钥）
     * @param {Object} model 模型配置对象
     * @returns {boolean} 模型是否可用
     */
    isModelAvailable(model) {
        return !!(model && model.apiKey && model.isActive);
    }

    /**
     * 获取模型统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getModelStats() {
        const allModels = await this.getAllModels();
        
        const stats = {
            total: allModels.length,
            text: allModels.filter(m => m.type === 'text').length,
            image: allModels.filter(m => m.type === 'image').length,
            active: allModels.filter(m => m.isActive).length,
            withApiKey: allModels.filter(m => m.apiKey).length,
            byProvider: {}
        };

        // 按提供商统计
        allModels.forEach(model => {
            if (!stats.byProvider[model.provider]) {
                stats.byProvider[model.provider] = 0;
            }
            stats.byProvider[model.provider]++;
        });

        return stats;
    }

    /**
     * 转换为Emergency Check格式
     * 为了兼容现有的emergency-check页面
     * @returns {Promise<Array>} Emergency Check格式的模型配置
     */
    async getEmergencyCheckModels() {
        const textModels = await this.getTextModels();
        
        return textModels.map((model, index) => ({
            id: model._id || `model_${index}`,
            name: model.name,
            model: model.model,
            provider: model.provider,
            temperature: model.config?.temperature || 0.7,
            max_tokens: model.config?.max_tokens || 2000,
            apiKeyEnv: this.getApiKeyEnvName(model.provider),
            baseURL: model.baseURL,
            supportsStreaming: model.config?.supportsStreaming || false,
            supportsThinking: model.config?.supportsThinking || false
        }));
    }

    /**
     * 根据提供商获取对应的环境变量名称
     * @param {string} provider 提供商名称
     * @returns {string} 环境变量名称
     */
    getApiKeyEnvName(provider) {
        const mapping = {
            'deepseek-tencent': 'TENCENT_AI_API_KEY',
            'deepseek-native': 'DEEP_SEEK_API_KEY',
            'hunyuan-exp': 'TENCENT_AI_API_KEY',
            'DouBao': 'DOU_BAO_API_KEY',
            'OpenAI': 'OPENAI_API_KEY',
            'Tencent': 'TENCENT_AI_API_KEY'
        };
        return mapping[provider] || 'UNKNOWN_API_KEY';
    }

    /**
     * 检查缓存是否有效
     * @param {string} cacheKey 缓存键
     * @returns {boolean} 缓存是否有效
     */
    isCacheValid(cacheKey) {
        return this.cache.has(cacheKey) && 
               (Date.now() - this.lastCacheUpdate) < this.cacheTime;
    }

    /**
     * 清除所有缓存
     */
    clearCache() {
        this.cache.clear();
        this.lastCacheUpdate = 0;
        console.log('[AI模型管理] 缓存已清除');
    }

    /**
     * 验证模型配置的完整性
     * @param {Object} model 模型配置对象
     * @returns {Object} 验证结果
     */
    validateModel(model) {
        const errors = [];
        const warnings = [];

        // 必需字段检查
        const requiredFields = ['name', 'type', 'model', 'provider', 'baseURL'];
        requiredFields.forEach(field => {
            if (!model[field]) {
                errors.push(`缺少必需字段: ${field}`);
            }
        });

        // API密钥检查
        if (!model.apiKey) {
            warnings.push('API密钥未设置，模型不可用');
        }

        // 类型检查
        if (model.type && !['text', 'image'].includes(model.type)) {
            errors.push('模型类型必须是 text 或 image');
        }

        // 配置检查
        if (model.type === 'text' && model.config) {
            if (model.config.temperature && 
                (model.config.temperature < 0 || model.config.temperature > 2)) {
                warnings.push('Temperature 应该在 0-2 之间');
            }
            if (model.config.max_tokens && model.config.max_tokens < 1) {
                warnings.push('max_tokens 应该大于 0');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}

// 创建单例实例
const aiModelManager = new AIModelManager();

module.exports = aiModelManager;

// 也导出类，以便在需要时创建新实例
module.exports.AIModelManager = AIModelManager; 