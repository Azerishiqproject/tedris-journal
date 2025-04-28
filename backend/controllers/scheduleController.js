const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Location = require('../models/Location');
const CourseType = require('../models/CourseType');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

// Tüm ders programını getir (ilişkili verilerle birlikte)
exports.getAllSchedules = async (req, res) => {
  try {
    console.log('Getting all schedules');

    // Tarih filtresi için query parametreleri
    const { startDate, endDate } = req.query;
    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate)
        }
      };
    } else if (endDate) {
      dateFilter = {
        date: {
          $lte: new Date(endDate)
        }
      };
    }

    // Get active season IDs
    const Season = require('../models/Season');
    const activeSeasons = await Season.find({ isActive: true }).select('_id').lean();
    const activeSeasonIds = activeSeasons.map(season => season._id);

    // Complete query with season filter
    const query = {
      ...dateFilter,
      $or: [
        { seasonId: { $in: activeSeasonIds } }, // Belongs to an active season
        { seasonId: null } // No season assigned
      ]
    };

    // Ana sorgu
    const schedules = await Schedule.find(query)
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Yanıtı hazırla
    const formattedSchedules = schedules.map(schedule => {
      // Check if required fields exist to prevent errors
      if (!schedule || !schedule.primaryTeacherId || !schedule.locationId || !schedule.courseTypeId) {
        console.error('Invalid schedule data:', schedule);
        return null; // Skip this item
      }

      try {
        return {
          id: schedule._id.toString(),
          teacherIds: schedule.teacherIds
            ? schedule.teacherIds.map(t => ({
              id: t._id.toString(),
              name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
              email: t.email
            }))
            : [],
          primaryTeacherId: schedule.primaryTeacherId._id.toString(),
          primaryTeacherName: `${schedule.primaryTeacherId.firstName || ''} ${schedule.primaryTeacherId.lastName || ''}`.trim(),
          locationId: schedule.locationId._id.toString(),
          locationName: schedule.locationId.name,
          courseTypeId: schedule.courseTypeId._id.toString(),
          type: schedule.courseTypeId.name,
          seasonId: schedule.seasonId ? schedule.seasonId._id.toString() : null,
          seasonName: schedule.seasonId ? schedule.seasonId.name : null,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          subject: schedule.subject,
          isChecked: schedule.isChecked,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt
        };
      } catch (formatError) {
        console.error('Error formatting schedule:', formatError, schedule);
        return null; // Skip this item
      }
    })
      .filter(Boolean); // Filter out null items

    res.json({ schedules: formattedSchedules });
  } catch (error) {
    console.error('Get all schedules error:', error);
    res.status(500).json({ message: 'Ders programı yüklenirken bir hata oluştu.' });
  }
};

// ID'ye göre ders programı kaydını getir
exports.getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    const schedule = await Schedule.findById(id)
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    if (!schedule) {
      return res.status(404).json({ message: 'Ders programı kaydı bulunamadı.' });
    }

    // Formatı hazırla
    const formattedSchedule = {
      id: schedule._id.toString(),
      teacherIds: schedule.teacherIds
        ? schedule.teacherIds.map(t => ({
          id: t._id.toString(),
          name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
          email: t.email
        }))
        : [],
      primaryTeacherId: schedule.primaryTeacherId._id.toString(),
      primaryTeacherName: `${schedule.primaryTeacherId.firstName || ''} ${schedule.primaryTeacherId.lastName || ''}`.trim(),
      locationId: schedule.locationId._id.toString(),
      locationName: schedule.locationId.name,
      courseTypeId: schedule.courseTypeId._id.toString(),
      type: schedule.courseTypeId.name,
      seasonId: schedule.seasonId ? schedule.seasonId._id.toString() : null,
      seasonName: schedule.seasonId ? schedule.seasonId.name : null,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      subject: schedule.subject,
      isChecked: schedule.isChecked,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt
    };

    res.json({ schedule: formattedSchedule });
  } catch (error) {
    console.error('Get schedule by id error:', error);
    res.status(500).json({ message: 'Ders programı kaydı yüklenirken bir hata oluştu.' });
  }
};

// Yeni ders programı kaydı oluştur
exports.createSchedule = async (req, res) => {
  try {
    const { teacherIds, primaryTeacherId, locationId, courseTypeId, seasonId, date, startTime, endTime, subject } = req.body;

    // Gerekli alanların kontrolü
    if (!teacherIds || !teacherIds.length || !primaryTeacherId || !locationId || !courseTypeId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        message: 'Tüm alanları doldurmanız gerekmektedir.'
      });
    }

    // ObjectID formatlarını doğrula
    if (!mongoose.Types.ObjectId.isValid(primaryTeacherId) ||
        !mongoose.Types.ObjectId.isValid(locationId) ||
        !mongoose.Types.ObjectId.isValid(courseTypeId) ||
        (seasonId && !mongoose.Types.ObjectId.isValid(seasonId)) ||
        !teacherIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    // Ana öğretmenin öğretmenler listesinde olduğunu kontrol et
    if (!teacherIds.includes(primaryTeacherId)) {
      teacherIds.push(primaryTeacherId);
    }

    // İlişkili kayıtların varlığını kontrol et
    const [primaryTeacherExists, locationExists, courseTypeExists] = await Promise.all([
      User.exists({ _id: primaryTeacherId, role: 'teacher' }),
      Location.exists({ _id: locationId }),
      CourseType.exists({ _id: courseTypeId })
    ]);

    // Tüm öğretmenlerin varlığını kontrol et
    const teachersExist = await User.countDocuments({ _id: { $in: teacherIds }, role: 'teacher' });
    if (teachersExist !== teacherIds.length) {
      return res.status(400).json({ message: 'Seçilen müəllimlərin bəzisi tapılmadı vəya müellim roluna sahib deyil.' });
    }

    // Sezon varlığını kontrol et (eğer belirtilmişse)
    let seasonExists = true;
    if (seasonId) {
      seasonExists = await Schedule.db.model('Season').exists({ _id: seasonId });
      if (!seasonExists) {
        return res.status(400).json({ message: 'Seçilen sezon bulunamadı.' });
      }
    }

    if (!primaryTeacherExists) {
      return res.status(400).json({ message: 'Seçilen əsas müəllim tapılmadı vəya müellim roluna sahib deyil.' });
    }

    if (!locationExists) {
      return res.status(400).json({ message: 'Seçilen ders yeri bulunamadı.' });
    }

    if (!courseTypeExists) {
      return res.status(400).json({ message: 'Seçilen ders tipi bulunamadı.' });
    }

    // Saat formatı doğrulama
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Geçersiz saat formatı. Lütfen HH:MM formatında girin.' });
    }

    // Başlangıç saatinin bitiş saatinden önce olduğunu kontrol et
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'Başlangıç saati bitiş saatinden önce olmalıdır.' });
    }

    // Çakışma kontrolü
    const conflict = await Schedule.checkConflicts({
      teacherIds,
      date,
      startTime,
      endTime
    });

    if (conflict.hasConflict) {
      // Çakışan öğretmenlerin isimlerini al
      const conflictingTeachers = await Promise.all(
        conflict.conflicts.map(async (c) => {
          const teacher = await User.findById(c.teacherId).select('firstName lastName').lean();
          return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Bilinmeyen Öğretmen';
        })
      );

      return res.status(409).json({
        message: `Öğretmen çakışması: ${conflictingTeachers.join(', ')} belirtilen zaman aralığında başka bir dersi var.`,
        conflicts: conflict.conflicts
      });
    }

    // Yeni ders programı oluştur
    const newSchedule = new Schedule({
      teacherIds,
      primaryTeacherId,
      locationId,
      courseTypeId,
      seasonId: seasonId || null,
      date,
      startTime,
      endTime,
      subject
    });

    // Veritabanına kaydet
    const savedSchedule = await newSchedule.save();

    // Kaydedilen kaydı ilişkili verilerle birlikte getir
    const populatedSchedule = await Schedule.findById(savedSchedule._id)
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    // Dönüş formatını hazırla
    const formattedSchedule = {
      id: savedSchedule._id.toString(),
      teacherIds: populatedSchedule.teacherIds.map(t => ({
        id: t._id.toString(),
        name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
        email: t.email
      })),
      primaryTeacherId: populatedSchedule.primaryTeacherId._id.toString(),
      primaryTeacherName: `${populatedSchedule.primaryTeacherId.firstName || ''} ${populatedSchedule.primaryTeacherId.lastName || ''}`.trim(),
      locationId: populatedSchedule.locationId._id.toString(),
      locationName: populatedSchedule.locationId.name,
      courseTypeId: populatedSchedule.courseTypeId._id.toString(),
      type: populatedSchedule.courseTypeId.name,
      seasonId: populatedSchedule.seasonId ? populatedSchedule.seasonId._id.toString() : null,
      seasonName: populatedSchedule.seasonId ? populatedSchedule.seasonId.name : null,
      date: populatedSchedule.date,
      startTime: populatedSchedule.startTime,
      endTime: populatedSchedule.endTime,
      subject: populatedSchedule.subject,
      isChecked: populatedSchedule.isChecked,
      createdAt: populatedSchedule.createdAt,
      updatedAt: populatedSchedule.updatedAt
    };

    res.status(201).json({
      message: 'Ders programı başarıyla oluşturuldu.',
      schedule: formattedSchedule
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ message: 'Ders programı oluşturulurken bir hata oluştu.' });
  }
};

// Ders programı kaydını güncelle
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherIds, primaryTeacherId, locationId, courseTypeId, seasonId, date, startTime, endTime, subject } = req.body;

    // ObjectID kontrolü
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    // Gerekli alanların kontrolü
    if (!teacherIds || !teacherIds.length || !primaryTeacherId || !locationId || !courseTypeId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        message: 'Tüm alanları doldurmanız gerekmektedir.'
      });
    }

    // ObjectID formatlarını doğrula
    if (!mongoose.Types.ObjectId.isValid(primaryTeacherId) ||
        !mongoose.Types.ObjectId.isValid(locationId) ||
        !mongoose.Types.ObjectId.isValid(courseTypeId) ||
        (seasonId && !mongoose.Types.ObjectId.isValid(seasonId)) ||
        !teacherIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    // Ana öğretmenin öğretmenler listesinde olduğunu kontrol et
    if (!teacherIds.includes(primaryTeacherId)) {
      teacherIds.push(primaryTeacherId);
    }

    // İlişkili kayıtların varlığını kontrol et
    const [primaryTeacherExists, locationExists, courseTypeExists] = await Promise.all([
      User.exists({ _id: primaryTeacherId, role: 'teacher' }),
      Location.exists({ _id: locationId }),
      CourseType.exists({ _id: courseTypeId })
    ]);

    // Tüm öğretmenlerin varlığını kontrol et
    const teachersExist = await User.countDocuments({ _id: { $in: teacherIds }, role: 'teacher' });
    if (teachersExist !== teacherIds.length) {
      return res.status(400).json({ message: 'Seçilen müəllimlərin bəzisi tapılmadı vəya müellim roluna sahib deyil.' });
    }

    // Sezon varlığını kontrol et (eğer belirtilmişse)
    if (seasonId && !await Schedule.db.model('Season').exists({ _id: seasonId })) {
      return res.status(400).json({ message: 'Seçilen sezon bulunamadı.' });
    }

    if (!primaryTeacherExists) {
      return res.status(400).json({ message: 'Seçilen əsas müəllim tapılmadı vəya müellim roluna sahib deyil.' });
    }

    if (!locationExists) {
      return res.status(400).json({ message: 'Seçilen ders yeri bulunamadı.' });
    }

    if (!courseTypeExists) {
      return res.status(400).json({ message: 'Seçilen ders tipi bulunamadı.' });
    }

    // Saat formatı doğrulama
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Geçersiz saat formatı. Lütfen HH:MM formatında girin.' });
    }

    // Başlangıç saatinin bitiş saatinden önce olduğunu kontrol et
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'Başlangıç saati bitiş saatinden önce olmalıdır.' });
    }

    // Kaydın varlığını kontrol et
    const scheduleExists = await Schedule.findById(id);
    if (!scheduleExists) {
      return res.status(404).json({ message: 'Ders programı kaydı bulunamadı.' });
    }

    // Çakışma kontrolü
    const conflict = await Schedule.checkConflicts({
      teacherIds,
      date,
      startTime,
      endTime
    }, id);

    if (conflict.hasConflict) {
      // Çakışan öğretmenlerin isimlerini al
      const conflictingTeachers = await Promise.all(
        conflict.conflicts.map(async (c) => {
          const teacher = await User.findById(c.teacherId).select('firstName lastName').lean();
          return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Bilinmeyen Öğretmen';
        })
      );

      return res.status(409).json({
        message: `Öğretmen çakışması: ${conflictingTeachers.join(', ')} belirtilen zaman aralığında başka bir dersi var.`,
        conflicts: conflict.conflicts
      });
    }

    // Kayıt güncelleme
    scheduleExists.teacherIds = teacherIds;
    scheduleExists.primaryTeacherId = primaryTeacherId;
    scheduleExists.locationId = locationId;
    scheduleExists.courseTypeId = courseTypeId;
    scheduleExists.seasonId = seasonId || null;
    scheduleExists.date = new Date(date);
    scheduleExists.startTime = startTime;
    scheduleExists.endTime = endTime;
    scheduleExists.subject = subject;

    // Değişiklikleri kaydet
    await scheduleExists.save();

    // Güncellenen kaydı ilişkili verilerle birlikte getir
    const updatedSchedule = await Schedule.findById(id)
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    // Dönüş formatını hazırla
    const formattedSchedule = {
      id: updatedSchedule._id.toString(),
      teacherIds: updatedSchedule.teacherIds.map(t => ({
        id: t._id.toString(),
        name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
        email: t.email
      })),
      primaryTeacherId: updatedSchedule.primaryTeacherId._id.toString(),
      primaryTeacherName: `${updatedSchedule.primaryTeacherId.firstName || ''} ${updatedSchedule.primaryTeacherId.lastName || ''}`.trim(),
      locationId: updatedSchedule.locationId._id.toString(),
      locationName: updatedSchedule.locationId.name,
      courseTypeId: updatedSchedule.courseTypeId._id.toString(),
      type: updatedSchedule.courseTypeId.name,
      seasonId: updatedSchedule.seasonId ? updatedSchedule.seasonId._id.toString() : null,
      seasonName: updatedSchedule.seasonId ? updatedSchedule.seasonId.name : null,
      date: updatedSchedule.date,
      startTime: updatedSchedule.startTime,
      endTime: updatedSchedule.endTime,
      subject: updatedSchedule.subject,
      isChecked: updatedSchedule.isChecked,
      createdAt: updatedSchedule.createdAt,
      updatedAt: updatedSchedule.updatedAt
    };

    res.json({
      message: 'Ders programı başarıyla güncellendi.',
      schedule: formattedSchedule
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ message: 'Ders programı güncellenirken bir hata oluştu.' });
  }
};

// Ders programı kaydını sil
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    const schedule = await Schedule.findByIdAndDelete(id);

    if (!schedule) {
      return res.status(404).json({ message: 'Silinmek istenen ders programı kaydı bulunamadı.' });
    }

    res.json({
      message: 'Ders programı başarıyla silindi.',
      id: schedule._id.toString()
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ message: 'Ders programı silinirken bir hata oluştu.' });
  }
};

// Ders kontrol durumunu değiştir
exports.toggleCheckStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    const schedule = await Schedule.findById(id);

    if (!schedule) {
      return res.status(404).json({ message: 'Ders kaydı bulunamadı.' });
    }

    // Kontrol durumunu tersine çevir
    schedule.isChecked = !schedule.isChecked;
    await schedule.save();

    // İlişkili verileri çekip yanıtla
    const updatedSchedule = await Schedule.findById(id)
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    // Dönüş formatını hazırla
    const formattedSchedule = {
      id: updatedSchedule._id.toString(),
      teacherIds: updatedSchedule.teacherIds.map(t => ({
        id: t._id.toString(),
        name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
        email: t.email
      })),
      primaryTeacherId: updatedSchedule.primaryTeacherId._id.toString(),
      primaryTeacherName: `${updatedSchedule.primaryTeacherId.firstName || ''} ${updatedSchedule.primaryTeacherId.lastName || ''}`.trim(),
      locationId: updatedSchedule.locationId._id.toString(),
      locationName: updatedSchedule.locationId.name,
      courseTypeId: updatedSchedule.courseTypeId._id.toString(),
      type: updatedSchedule.courseTypeId.name,
      seasonId: updatedSchedule.seasonId ? updatedSchedule.seasonId._id.toString() : null,
      seasonName: updatedSchedule.seasonId ? updatedSchedule.seasonId.name : null,
      date: updatedSchedule.date,
      startTime: updatedSchedule.startTime,
      endTime: updatedSchedule.endTime,
      subject: updatedSchedule.subject,
      isChecked: updatedSchedule.isChecked,
      createdAt: updatedSchedule.createdAt,
      updatedAt: updatedSchedule.updatedAt
    };

    res.json({
      message: schedule.isChecked ? 'Ders kontrol edildi olarak işaretlendi.' : 'Ders kontrol edilmedi olarak işaretlendi.',
      schedule: formattedSchedule
    });
  } catch (error) {
    console.error('Toggle check status error:', error);
    res.status(500).json({ message: 'Ders kontrol durumu değiştirilirken bir hata oluştu.' });
  }
};

// Check for teacher conflicts endpoint
exports.checkTeacherConflict = asyncHandler(async (req, res) => {
  const { teacherIds, date, startTime, endTime, excludeLessonId } = req.body;

  if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
    return res.status(400).json({ hasConflict: false, message: 'Öğretmen seçilmedi' });
  }

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ hasConflict: false, message: 'Tarih ve saat bilgileri gerekli' });
  }

  try {
    // Check for conflicts using the schema's built-in method
    const conflict = await Schedule.checkConflicts({
      teacherIds,
      date,
      startTime,
      endTime
    }, excludeLessonId);

    if (conflict.hasConflict) {
      // Get teacher names for the conflict message
      const conflictingTeachers = await Promise.all(
        conflict.conflicts.map(async (c) => {
          const teacher = await User.findById(c.teacherId).select('firstName lastName').lean();
          return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Bilinmeyen Öğretmen';
        })
      );

      return res.json({
        hasConflict: true,
        conflictingLesson: conflict.conflicts[0].conflict,
        message: `Öğretmen çakışması: ${conflictingTeachers.join(', ')} belirtilen zaman aralığında başka bir dersi var.`
      });
    }

    // If we get here, no conflicts were found for any teacher
    res.json({ hasConflict: false });
  } catch (error) {
    console.error('Error checking teacher conflict:', error);
    res.status(500).json({ hasConflict: false, message: 'Öğretmen çakışması kontrol edilirken bir hata oluştu' });
  }
});

// Check for teacher leave endpoint
exports.checkTeacherLeave = asyncHandler(async (req, res) => {
  const { teacherIds, date } = req.body;

  if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
    return res.status(400).json({ hasLeave: false, message: 'Öğretmen seçilmedi' });
  }

  if (!date) {
    return res.status(400).json({ hasLeave: false, message: 'Tarih bilgisi gerekli' });
  }

  try {
    // For now, just return no leave to allow the form to proceed
    // We can implement actual leave checking when the TeacherLeave model is available
    res.json({ hasLeave: false });

    /* Uncomment and implement when TeacherLeave model is available
    const lessonDate = new Date(date);

    // Check each teacher for leaves
    for (const teacherId of teacherIds) {
      // Find if the teacher has leave on this date
      const teacherLeave = await TeacherLeave.findOne({
        teacherId: teacherId,
        startDate: { $lte: lessonDate },
        endDate: { $gte: lessonDate }
      }).populate('teacherId', 'firstName lastName').lean();

      if (teacherLeave) {
        const teacher = await User.findById(teacherId).select('firstName lastName').lean();
        return res.json({
          hasLeave: true,
          message: `${teacher.firstName} ${teacher.lastName} ${teacherLeave.startDate} - ${teacherLeave.endDate} tarihleri arasında izinli.`
        });
      }
    }

    // If we get here, no leaves were found for any teacher
    res.json({ hasLeave: false });
    */
  } catch (error) {
    console.error('Error checking teacher leave:', error);
    res.status(500).json({ hasLeave: false, message: 'Öğretmen izni kontrol edilirken bir hata oluştu' });
  }
});

// Get all completed lessons
exports.getCompletedLessons = async (req, res) => {
  try {
    console.log('Getting completed lessons');

    // Find all lessons where isChecked is true
    const completedLessons = await Schedule.find({ isChecked: true })
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    console.log(`Found ${completedLessons.length} completed lessons`);

    // Format the response - handle possible null values
    const formattedLessons = completedLessons.map(lesson => {
      // Ensure teacher exists before accessing properties
      const teacherIds = lesson.teacherIds ? lesson.teacherIds.map(t => t._id.toString()) : null;
      const teacherNames = lesson.teacherIds ? lesson.teacherIds.map(t => `${t.firstName || ''} ${t.lastName || ''}`.trim()) : null;

      // Ensure location exists
      const locationId = lesson.locationId ? lesson.locationId._id.toString() : null;
      const locationName = lesson.locationId ? lesson.locationId.name : 'Unknown Location';

      // Ensure courseType exists
      const courseTypeId = lesson.courseTypeId ? lesson.courseTypeId._id.toString() : null;
      const courseTypeName = lesson.courseTypeId ? lesson.courseTypeId.name : 'Unknown Type';

      return {
        id: lesson._id.toString(),
        teacherIds,
        teacherNames,
        locationId,
        locationName,
        courseTypeId,
        type: courseTypeName,
        seasonId: lesson.seasonId ? lesson.seasonId._id.toString() : null,
        seasonName: lesson.seasonId ? lesson.seasonId.name : null,
        date: lesson.date,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        subject: lesson.subject,
        isChecked: lesson.isChecked,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt
      };
    });

    res.json({
      completedLessons: formattedLessons
    });
  } catch (error) {
    console.error('Get completed lessons error:', error);
    res.status(500).json({ message: 'Tamamlanan dərsləri gətirərkən xəta baş verdi.' });
  }
};

// Update lesson completion status (for teachers - time restricted)
exports.updateLessonCompletion = async (req, res) => {
  try {
    const { id } = req.params;
    const { completed, completedAt, completedBy } = req.body;

    console.log(`Updating lesson completion: id=${id}, completed=${completed}, by=${completedBy}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ID format:', id);
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    const schedule = await Schedule.findById(id);

    if (!schedule) {
      console.log('Lesson not found:', id);
      return res.status(404).json({ message: 'Ders kaydı bulunamadı.' });
    }

    // Log the authentication details for debugging
    console.log('User info:', req.user
      ? {
        id: req.user.id,
        role: req.user.role
      }
      : 'No user found in request');
    console.log('Lesson teacherIds:', schedule.teacherIds.map(t => t._id.toString()));

    // Only allow teacher to update their own lessons
    if (req.user && req.user.role === 'teacher' &&
        !schedule.teacherIds.some(t => t._id.toString() === req.user.id.toString())) {
      console.log('Teacher permission denied - not their lesson');
      return res.status(403).json({
        message: 'Bu dərsi yalnız dərsin müəllimi tamamlaya bilər.'
      });
    }

    // Update completion status
    schedule.isChecked = completed;

    // If we have additional metadata, save it too
    if (completed && completedAt) {
      // We could store this in additional fields if needed
      // Here we're just updating the isChecked field for now
      console.log('Completed at:', completedAt);
    }

    await schedule.save();
    console.log('Lesson completion status updated successfully');

    // Return the updated schedule
    const updatedSchedule = await Schedule.findById(id)
      .populate('teacherIds', 'firstName lastName email')
      .populate('primaryTeacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    // Format the response - handle possible null values
    const formattedSchedule = {
      id: updatedSchedule._id.toString(),
      teacherIds: updatedSchedule.teacherIds.map(t => ({
        id: t._id.toString(),
        name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
        email: t.email
      })),
      primaryTeacherId: updatedSchedule.primaryTeacherId._id.toString(),
      primaryTeacherName: `${updatedSchedule.primaryTeacherId.firstName || ''} ${updatedSchedule.primaryTeacherId.lastName || ''}`.trim(),
      locationId: updatedSchedule.locationId._id.toString(),
      locationName: updatedSchedule.locationId.name,
      courseTypeId: updatedSchedule.courseTypeId._id.toString(),
      type: updatedSchedule.courseTypeId.name,
      seasonId: updatedSchedule.seasonId ? updatedSchedule.seasonId._id.toString() : null,
      seasonName: updatedSchedule.seasonId ? updatedSchedule.seasonId.name : null,
      date: updatedSchedule.date,
      startTime: updatedSchedule.startTime,
      endTime: updatedSchedule.endTime,
      subject: updatedSchedule.subject,
      isChecked: updatedSchedule.isChecked,
      createdAt: updatedSchedule.createdAt,
      updatedAt: updatedSchedule.updatedAt
    };

    res.json({
      message: completed ? 'Dərs uğurla tamamlandı.' : 'Dərs tamamlanmamış olaraq işarələndi.',
      schedule: formattedSchedule
    });
  } catch (error) {
    console.error('Update lesson completion error:', error);
    res.status(500).json({ message: 'Dərs tamamlama statusu yenilənərkən xəta baş verdi.' });
  }
};
