const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');

// 测试路由
router.get('/test', (req, res) => {
  res.json({ message: 'API测试成功' });
});

// Todo相关路由
router.get('/todos', todoController.getAllTodos);
router.post('/todos', todoController.createTodo);
router.get('/todos/:id', todoController.getTodoById);
router.put('/todos/:id', todoController.updateTodo);
router.delete('/todos/:id', todoController.deleteTodo);

module.exports = router;
