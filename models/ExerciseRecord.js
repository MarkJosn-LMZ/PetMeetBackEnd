const mongoose = require('mongoose');

const exerciseRecordSchema = new mongoose.Schema({
  exerciseType: {
    type: String,
    enum: ['散步', '跑步', '玩耍', '游泳', '训练', '其他'],
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  intensity: {
    type: String,
    enum: ['低强度', '中等', '高强度'],
    default: '中等'
  },
  steps: {
    type: Number,
    default: 0
  },
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  PetMeetID: {
    type: String,
    default: ''
  },
  recordDate: {
    type: Date,
    default: Date.now
  },
  location: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true,
  collection: 'ai_exercise_record'
});

module.exports = mongoose.model('ExerciseRecord', exerciseRecordSchema);
