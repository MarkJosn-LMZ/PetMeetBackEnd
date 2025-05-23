const mongoose = require('mongoose');

const dietRecordSchema = new mongoose.Schema({
  foodType: {
    type: String,
    enum: ['早餐', '午餐', '晚餐', '零食', '其他'],
    required: true
  },
  foodName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    enum: ['g', 'ml', '份'],
    default: 'g'
  },
  waterAmount: {
    type: Number,
    default: 0
  },
  waterUnit: {
    type: String,
    enum: ['ml', 'L'],
    default: 'ml'
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
  collection: 'ai_diet_record'
});

module.exports = mongoose.model('DietRecord', dietRecordSchema);
