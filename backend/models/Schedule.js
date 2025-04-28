const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scheduleSchema = new Schema({
  // İlişkiler
  teacherIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    required: [true, 'Ən azı bir müəllim seçimi vacibdir']
  },
  primaryTeacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Bir əsas müəllim seçimi vacibdir']
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: [true, 'Dərs yeri seçimi vacibdir']
  },
  courseTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseType',
    required: [true, 'Dərs tipi seçimi vacibdir']
  },
  seasonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Season',
    required: false
  },

  // Zaman ve içerik bilgileri
  date: {
    type: Date,
    required: [true, 'Tarix vacibdir']
  },
  startTime: {
    type: String,
    required: [true, 'Başlanğıç saati vacibdir'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Geçerli bir saat formatı giriniz (HH:MM)']
  },
  endTime: {
    type: String,
    required: [true, 'Bitiş saati vacibdir'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Geçerli bir saat formatı giriniz (HH:MM)']
  },
  subject: {
    type: String,
    required: [true, 'Dərs mövzusu vacibdir']
  },

  // Ders kontrol durumu
  isChecked: {
    type: Boolean,
    default: false
  },

  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Çoklu öğretmen çakışmalarını kontrol edecek statik metod
scheduleSchema.statics.checkConflicts = async function (scheduleData, excludeId = null) {
  const { teacherIds, date, startTime, endTime } = scheduleData;

  // Tarih kontrolü için başlangıç ve bitiş
  const scheduleDate = new Date(date);
  scheduleDate.setHours(0, 0, 0, 0); // Günün başlangıcı

  const nextDay = new Date(scheduleDate);
  nextDay.setDate(nextDay.getDate() + 1); // Sonraki günün başlangıcı

  // Çakışma sorgusu için temel koşullar
  const baseQuery = {
    date: {
      $gte: scheduleDate,
      $lt: nextDay
    },
    $or: [
      // Başlangıç zamanı mevcut ders aralığında
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  };

  // Düzenleme durumunda mevcut kaydı hariç tut
  if (excludeId) {
    baseQuery._id = { $ne: excludeId };
  }

  // Her bir öğretmen için çakışma kontrolü
  const conflicts = [];

  for (const teacherId of teacherIds) {
    // Öğretmen çakışması kontrolü
    const teacherConflict = await this.findOne({
      ...baseQuery,
      teacherIds: teacherId
    });

    if (teacherConflict) {
      conflicts.push({
        teacherId,
        conflict: teacherConflict
      });
    }
  }

  if (conflicts.length > 0) {
    return {
      hasConflict: true,
      type: 'teacher',
      conflicts
    };
  }

  // Çakışma yok
  return { hasConflict: false };
};

module.exports = mongoose.model('Schedule', scheduleSchema);
