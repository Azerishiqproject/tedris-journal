const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const seasonSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Sezon adı zorunludur'],
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  startDate: {
    type: Date,
    required: false
  },
  endDate: {
    type: Date,
    required: false
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

// Function to delete all lessons associated with a season
async function deleteAssociatedLessons(seasonId, seasonName) {
  try {
    const Schedule = mongoose.model('Schedule');
    const result = await Schedule.deleteMany({ seasonId });
    console.log(`Deleted ${result.deletedCount} lessons associated with the deleted season (${seasonName}, ID: ${seasonId})`);
  } catch (error) {
    console.error('Error deleting associated lessons:', error);
    throw error;
  }
}

// Pre-remove hook (for document.remove())
seasonSchema.pre('remove', async function (next) {
  try {
    await deleteAssociatedLessons(this._id, this.name);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-deleteOne hook (for Model.deleteOne())
seasonSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    await deleteAssociatedLessons(this._id, this.name);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-findOneAndDelete hook (for findByIdAndDelete and findOneAndDelete)
seasonSchema.pre('findOneAndDelete', async function (next) {
  try {
    const seasonDoc = await this.model.findOne(this.getFilter());
    if (seasonDoc) {
      await deleteAssociatedLessons(seasonDoc._id, seasonDoc.name);
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Season', seasonSchema);
