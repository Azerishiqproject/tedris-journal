const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const courseTypeSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Kurs tipi adı zorunludur'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Kurs tipi açıklaması zorunludur'],
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

module.exports = mongoose.model('CourseType', courseTypeSchema);
