const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const locationSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Mekan adı zorunludur'],
    trim: true
  },
  description: {
    type: String,
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

module.exports = mongoose.model('Location', locationSchema);
