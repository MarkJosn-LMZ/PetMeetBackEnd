const { getCloudBase } = require('../config/cloudbaseConfig');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const util = require('util');
const unlinkFile = util.promisify(fs.unlink);

// 初始化 CloudBase
const app = getCloudBase();

/**
 * 上传文件到 CloudBase 云存储
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 */
const uploadFile = async (req, res) => {
  try {
    // 获取用户ID和PetMeetID
    const userId = req.user?.userId;
    const PetMeetID = req.user?.PetMeetID;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    // 根据用户标识生成文件路径，优先使用PetMeetID
    let userFolder = '';
    if (PetMeetID) {
      userFolder = `user_${PetMeetID}`;
    } else if (userId) {
      userFolder = `user_${userId.substring(0, 8)}`;
    }
    
    const fileName = `user_avatars/${userFolder}/${uuidv4()}${fileExt}`;
    const fileContent = fs.createReadStream(file.path);

    // 上传文件到云存储
    const uploadRes = await app.uploadFile({
      cloudPath: fileName,
      fileContent: fileContent
    });

    // 删除临时文件
    await unlinkFile(file.path);

    // 获取文件访问链接
    const fileUrl = await app.getTempFileURL({
      fileList: [uploadRes.fileID]
    });

    res.json({
      success: true,
      url: fileUrl.fileList[0].tempFileURL,
      fileID: uploadRes.fileID,
      userId: userId,
      PetMeetID: PetMeetID,
      userFolder: userFolder
    });
  } catch (error) {
    console.error('上传文件失败:', error);
    // 如果出错，确保删除临时文件
    if (req.file && req.file.path) {
      await unlinkFile(req.file.path).catch(console.error);
    }
    res.status(500).json({ success: false, message: '上传文件失败', error: error.message });
  }
};

/**
 * 删除 CloudBase 云存储中的文件
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 */
const deleteFile = async (req, res) => {
  try {
    const { fileID } = req.body;
    // 获取用户ID和PetMeetID用于权限检查
    const userId = req.user?.userId;
    const PetMeetID = req.user?.PetMeetID;

    if (!fileID) {
      return res.status(400).json({ success: false, message: '缺少文件ID' });
    }
    
    // 权限检查，可以根据文件路径中的用户标识来验证
    // 如果文件路径包含用户的PetMeetID或userId表示此文件属于该用户
    // 这里可以添加权限检查逻辑，比如查询文件元数据或根据文件路径检查

    // 删除文件
    await app.deleteFile({
      fileList: [fileID]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ success: false, message: '删除文件失败', error: error.message });
  }
};

/**
 * 上传帖子图片到 CloudBase 云存储
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 */
const uploadPostImage = async (req, res) => {
  try {
    // 获取用户ID和PetMeetID
    const userId = req.user?.userId;
    const PetMeetID = req.user?.PetMeetID;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    // 生成随机文件名
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 100000);
    const fileName = `post_images/${timestamp}-${randomSuffix}${fileExt}`;
    const fileContent = fs.createReadStream(file.path);

    console.log(`开始上传帖子图片，用户ID: ${userId}, 目标路径: ${fileName}`);

    // 上传文件到云存储
    const uploadRes = await app.uploadFile({
      cloudPath: fileName,
      fileContent: fileContent
    });

    console.log('帖子图片上传成功:', uploadRes.fileID);

    // 删除临时文件
    await unlinkFile(file.path);

    // 获取文件访问链接
    const fileUrl = await app.getTempFileURL({
      fileList: [uploadRes.fileID]
    });

    // 返回上传结果
    res.json({
      success: true,
      url: fileUrl.fileList[0].tempFileURL,
      fileID: uploadRes.fileID,
      cloudPath: fileName
    });
  } catch (error) {
    console.error('上传帖子图片失败:', error);
    // 如果出错，确保删除临时文件
    if (req.file && req.file.path) {
      await unlinkFile(req.file.path).catch(console.error);
    }
    res.status(500).json({ success: false, message: '上传帖子图片失败', error: error.message });
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  uploadPostImage
};
