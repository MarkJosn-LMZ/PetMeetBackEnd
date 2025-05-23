const { getDatabase } = require('../config/cloudbaseConfig');

const db = getDatabase();
const petCollection = db.collection('ai_pet');
const _ = db.command;

/**
 * 添加宠物信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
const addPet = async (req, res) => {
    try {
        const openid = req.user.openid;
        const PetMeetID = req.user.PetMeetID;
        const petData = req.body;

        if (!petData) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少宠物数据' 
            });
        }

        // 添加用户标识和时间戳
        const dataToAdd = {
            ...petData,
            _openid: openid,
            PetMeetID: PetMeetID, // 支持PetMeetID
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
        };

        console.log('[PetController] 添加宠物数据:', JSON.stringify(dataToAdd));
        const addRes = await petCollection.add({ data: dataToAdd });
        console.log('[PetController] 添加结果:', JSON.stringify(addRes));
        
        return res.json({ 
            success: true, 
            message: '添加成功', 
            data: { _id: addRes._id } 
        });
    } catch (error) {
        console.error('[PetController] 添加宠物失败:', error);
        return res.status(500).json({ 
            success: false, 
            message: '添加宠物失败', 
            error: error.message 
        });
    }
};

/**
 * 更新宠物信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
const updatePet = async (req, res) => {
    try {
        const openid = req.user.openid;
        const PetMeetID = req.user.PetMeetID;
        const { pet_id } = req.params;
        const petData = req.body;

        if (!pet_id || !petData) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少宠物ID或宠物数据' 
            });
        }

        // 准备更新数据，添加更新时间戳
        const dataToUpdate = {
            ...petData,
            updatedAt: db.serverDate()
        };

        // 移除不允许用户更新的字段
        delete dataToUpdate._id;
        delete dataToUpdate._openid;
        delete dataToUpdate.PetMeetID;
        delete dataToUpdate.createdAt;

        console.log(`[PetController] 更新宠物(ID: ${pet_id})数据:`, JSON.stringify(dataToUpdate));

        // 构建查询条件，确保用户只能更新自己的宠物
        let query = { _id: pet_id };
        
        // 如果有PetMeetID，优先使用PetMeetID进行查询
        if (PetMeetID) {
            query.PetMeetID = PetMeetID;
        } else {
            query._openid = openid;
        }

        const updateRes = await petCollection.where(query).update({ data: dataToUpdate });

        console.log('[PetController] 更新结果:', JSON.stringify(updateRes));
        if (updateRes.stats.updated > 0) {
            return res.json({ 
                success: true, 
                message: '更新成功' 
            });
        } else {
            return res.status(404).json({ 
                success: false, 
                message: '更新失败，未找到匹配记录或无权限' 
            });
        }
    } catch (error) {
        console.error(`[PetController] 更新宠物失败:`, error);
        return res.status(500).json({ 
            success: false, 
            message: '更新宠物失败', 
            error: error.message 
        });
    }
};

/**
 * 删除宠物信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
const deletePet = async (req, res) => {
    try {
        const openid = req.user.openid;
        const PetMeetID = req.user.PetMeetID;
        const { pet_id } = req.params;

        if (!pet_id) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少宠物ID' 
            });
        }

        console.log(`[PetController] 删除宠物(ID: ${pet_id})...`);

        // 构建查询条件，确保用户只能删除自己的宠物
        let query = { _id: pet_id };
        
        // 如果有PetMeetID，优先使用PetMeetID进行查询
        if (PetMeetID) {
            query.PetMeetID = PetMeetID;
        } else {
            query._openid = openid;
        }

        const deleteRes = await petCollection.where(query).remove();

        console.log('[PetController] 删除结果:', JSON.stringify(deleteRes));
        if (deleteRes.stats.removed > 0) {
            return res.json({ 
                success: true, 
                message: '删除成功' 
            });
        } else {
            return res.status(404).json({ 
                success: false, 
                message: '删除失败，未找到匹配记录或无权限' 
            });
        }
    } catch (error) {
        console.error(`[PetController] 删除宠物失败:`, error);
        return res.status(500).json({ 
            success: false, 
            message: '删除宠物失败', 
            error: error.message 
        });
    }
};

/**
 * 获取宠物信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
const getPet = async (req, res) => {
    try {
        const openid = req.user.openid;
        const PetMeetID = req.user.PetMeetID;
        const { pet_id } = req.params;

        // 构建查询条件
        let query = {};
        
        // 如果指定了pet_id，则获取特定宠物
        if (pet_id) {
            query._id = pet_id;
        }

        // 根据用户标识筛选宠物
        // 如果有PetMeetID，优先使用PetMeetID进行查询
        if (PetMeetID) {
            query.PetMeetID = PetMeetID;
        } else {
            query._openid = openid;
        }

        console.log(`[PetController] 获取宠物信息，查询条件:`, JSON.stringify(query));
        
        // 获取宠物信息
        const petRes = await petCollection.where(query).limit(1).get();

        if (petRes.data && petRes.data.length > 0) {
            console.log(`[PetController] 找到宠物信息.`);
            return res.json({
                success: true,
                message: '获取宠物信息成功',
                data: petRes.data[0] // 返回查询到的第一个宠物数据
            });
        } else {
            console.log(`[PetController] 未找到宠物信息.`);
            return res.json({
                success: true, // 查询成功，但没有数据
                message: '未找到该用户的宠物信息',
                data: null
            });
        }
    } catch (error) {
        console.error(`[PetController] 获取宠物信息失败:`, error);
        return res.status(500).json({
            success: false,
            message: '查询宠物信息失败',
            error: error.message,
            data: null
        });
    }
};

/**
 * 获取用户所有宠物列表
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
const getPetList = async (req, res) => {
    try {
        const openid = req.user.openid;
        const PetMeetID = req.user.PetMeetID;

        // 构建查询条件
        let query = {};
        
        // 根据用户标识筛选宠物
        // 如果有PetMeetID，优先使用PetMeetID进行查询
        if (PetMeetID) {
            query.PetMeetID = PetMeetID;
        } else {
            query._openid = openid;
        }

        console.log(`[PetController] 获取宠物列表，查询条件:`, JSON.stringify(query));
        
        // 获取宠物列表
        const petRes = await petCollection.where(query).get();

        if (petRes.data && petRes.data.length > 0) {
            console.log(`[PetController] 找到${petRes.data.length}个宠物.`);
            return res.json({
                success: true,
                message: '获取宠物列表成功',
                data: petRes.data
            });
        } else {
            console.log(`[PetController] 未找到宠物信息.`);
            return res.json({
                success: true, // 查询成功，但没有数据
                message: '未找到该用户的宠物信息',
                data: []
            });
        }
    } catch (error) {
        console.error(`[PetController] 获取宠物列表失败:`, error);
        return res.status(500).json({
            success: false,
            message: '查询宠物列表失败',
            error: error.message,
            data: []
        });
    }
};

module.exports = {
    addPet,
    updatePet,
    deletePet,
    getPet,
    getPetList
};
