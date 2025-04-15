const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const courseSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Kurs adı zorunludur'],
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  category: {
    type: String,
    required: false,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
