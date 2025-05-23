const mongoose = require('mongoose');

const weightRecordSchema = new mongoose.Schema({
  weight: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    enum: ['kg', 'g'],
    default: 'kg'
  },
  bodyType: {
    type: String,
    enum: ['偏瘦', '标准', '偏胖', '肥胖', '理想体型'],
    default: '标准'
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
  description: {
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
  collection: 'ai_weight_record'
});

module.exports = mongoose.model('WeightRecord', weightRecordSchema);
