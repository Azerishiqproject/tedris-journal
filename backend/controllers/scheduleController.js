const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Location = require('../models/Location');
const CourseType = require('../models/CourseType');
const mongoose = require('mongoose');

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
      .populate('teacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Yanıtı hazırla
    const formattedSchedules = schedules.map(schedule => ({
      id: schedule._id.toString(),
      teacherId: schedule.teacherId._id.toString(),
      teacherName: schedule.teacherId.name,
      teacherEmail: schedule.teacherId.email,
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
    }));

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
      .populate('teacherId', 'firstName lastName email')
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
      teacherId: schedule.teacherId._id.toString(),
      teacherName: schedule.teacherId.name,
      teacherEmail: schedule.teacherId.email,
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
    const { teacherId, locationId, courseTypeId, seasonId, date, startTime, endTime, subject } = req.body;

    // Gerekli alanların kontrolü
    if (!teacherId || !locationId || !courseTypeId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        message: 'Tüm alanları doldurmanız gerekmektedir.'
      });
    }

    // ObjectID formatlarını doğrula
    if (!mongoose.Types.ObjectId.isValid(teacherId) ||
        !mongoose.Types.ObjectId.isValid(locationId) ||
        !mongoose.Types.ObjectId.isValid(courseTypeId) ||
        (seasonId && !mongoose.Types.ObjectId.isValid(seasonId))) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    // İlişkili kayıtların varlığını kontrol et
    const [teacherExists, locationExists, courseTypeExists] = await Promise.all([
      User.exists({ _id: teacherId, role: 'teacher' }),
      Location.exists({ _id: locationId }),
      CourseType.exists({ _id: courseTypeId })
    ]);

    // Sezon varlığını kontrol et (eğer belirtilmişse)
    let seasonExists = true;
    if (seasonId) {
      seasonExists = await Schedule.db.model('Season').exists({ _id: seasonId });
      if (!seasonExists) {
        return res.status(400).json({ message: 'Seçilen sezon bulunamadı.' });
      }
    }

    if (!teacherExists) {
      return res.status(400).json({ message: 'Seçilen müellim tapılmadı vəya müellim roluna sahib deyil.' });
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
      teacherId,
      locationId,
      date,
      startTime,
      endTime
    });

    if (conflict.hasConflict) {
      const conflictType = conflict.type === 'teacher' ? 'Müəllim' : 'Dərs yeri';
      return res.status(409).json({
        message: `${conflictType} için çakışma tespit edildi. Belirlenen saatte başka bir ders zaten mevcut.`,
        conflictType: conflict.type,
        conflictingId: conflict.conflictingId
      });
    }

    // Yeni ders programı oluştur
    const schedule = new Schedule({
      teacherId,
      locationId,
      courseTypeId,
      seasonId: seasonId || null,
      date,
      startTime,
      endTime,
      subject
    });

    await schedule.save();

    // İlişkili verileri çekip yanıtla
    const savedSchedule = await Schedule.findById(schedule._id)
      .populate('teacherId', 'name email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .lean();

    // Dönüş formatını hazırla
    const formattedSchedule = {
      id: savedSchedule._id.toString(),
      teacherId: savedSchedule.teacherId._id.toString(),
      teacherName: savedSchedule.teacherId.name,
      teacherEmail: savedSchedule.teacherId.email,
      locationId: savedSchedule.locationId._id.toString(),
      locationName: savedSchedule.locationId.name,
      courseTypeId: savedSchedule.courseTypeId._id.toString(),
      type: savedSchedule.courseTypeId.name,
      seasonId: savedSchedule.seasonId ? savedSchedule.seasonId._id.toString() : null,
      seasonName: savedSchedule.seasonId ? savedSchedule.seasonId.name : null,
      date: savedSchedule.date,
      startTime: savedSchedule.startTime,
      endTime: savedSchedule.endTime,
      subject: savedSchedule.subject,
      isChecked: savedSchedule.isChecked,
      createdAt: savedSchedule.createdAt,
      updatedAt: savedSchedule.updatedAt
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
    const { teacherId, locationId, courseTypeId, seasonId, date, startTime, endTime, subject } = req.body;

    // ID formatı doğrulama
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    // Gerekli alanların kontrolü
    if (!teacherId || !locationId || !courseTypeId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        message: 'Tüm alanları doldurmanız gerekmektedir.'
      });
    }

    // İlgili ID'lerin geçerliliğini kontrol et
    if (!mongoose.Types.ObjectId.isValid(teacherId) ||
        !mongoose.Types.ObjectId.isValid(locationId) ||
        !mongoose.Types.ObjectId.isValid(courseTypeId) ||
        (seasonId && !mongoose.Types.ObjectId.isValid(seasonId))) {
      return res.status(400).json({ message: 'Geçersiz ID formatı.' });
    }

    // Kaydın var olup olmadığını kontrol et
    const scheduleExists = await Schedule.findById(id);
    if (!scheduleExists) {
      return res.status(404).json({ message: 'Güncellenecek ders programı kaydı bulunamadı.' });
    }

    // İlişkili kayıtların varlığını kontrol et
    const [teacherExists, locationExists, courseTypeExists] = await Promise.all([
      User.exists({ _id: teacherId, role: 'teacher' }),
      Location.exists({ _id: locationId }),
      CourseType.exists({ _id: courseTypeId })
    ]);

    // Sezon varlığını kontrol et (eğer belirtilmişse)
    let seasonExists = true;
    if (seasonId) {
      seasonExists = await Schedule.db.model('Season').exists({ _id: seasonId });
      if (!seasonExists) {
        return res.status(400).json({ message: 'Seçilen sezon bulunamadı.' });
      }
    }

    if (!teacherExists) {
      return res.status(400).json({ message: 'Seçilen müellim tapılmadı vəya müellim roluna sahib deyil.' });
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
      teacherId,
      locationId,
      date,
      startTime,
      endTime
    }, id);

    if (conflict.hasConflict) {
      const conflictType = conflict.type === 'teacher' ? 'Müəllim' : 'Dərs yeri';
      return res.status(409).json({
        message: `${conflictType} için çakışma tespit edildi. Belirlenen saatte başka bir ders zaten mevcut.`,
        conflictType: conflict.type,
        conflictingId: conflict.conflictingId
      });
    }

    // Programı güncelle
    scheduleExists.teacherId = teacherId;
    scheduleExists.locationId = locationId;
    scheduleExists.courseTypeId = courseTypeId;
    scheduleExists.seasonId = seasonId || null;
    scheduleExists.date = date;
    scheduleExists.startTime = startTime;
    scheduleExists.endTime = endTime;
    scheduleExists.subject = subject;

    await scheduleExists.save();

    // İlişkili verileri çekip yanıtla
    const updatedSchedule = await Schedule.findById(id)
      .populate('teacherId', 'name email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .lean();

    // Dönüş formatını hazırla
    const formattedSchedule = {
      id: updatedSchedule._id.toString(),
      teacherId: updatedSchedule.teacherId._id.toString(),
      teacherName: updatedSchedule.teacherId.name,
      teacherEmail: updatedSchedule.teacherId.email,
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
      .populate('teacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    // Dönüş formatını hazırla
    const formattedSchedule = {
      id: updatedSchedule._id.toString(),
      teacherId: updatedSchedule.teacherId._id.toString(),
      teacherName: `${updatedSchedule.teacherId.firstName || ''} ${updatedSchedule.teacherId.lastName || ''}`.trim(),
      teacherEmail: updatedSchedule.teacherId.email,
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

// Check teacher conflicts
exports.checkTeacherConflict = async (req, res) => {
  try {
    const { teacherId, date, startTime, endTime, excludeLessonId } = req.body;

    // Required fields validation
    if (!teacherId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Eksik parametreler: teacherId, date, startTime ve endTime gereklidir.'
      });
    }

    // Valid teacher check
    const teacherExists = await User.exists({ _id: teacherId, role: 'teacher' });
    if (!teacherExists) {
      return res.status(400).json({ message: 'Olmayan müəllim ID.' });
    }

    // Time format validation
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Geçersiz saat formatı. Lütfen HH:MM formatında girin.' });
    }

    // Start time must be before end time
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'Başlangıç saati bitiş saatinden önce olmalıdır.' });
    }

    // Tarih kontrolü için başlangıç ve bitiş
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0); // Günün başlangıcı

    const nextDay = new Date(scheduleDate);
    nextDay.setDate(nextDay.getDate() + 1); // Sonraki günün başlangıcı

    // Çakışma sorgusu
    const query = {
      teacherId,
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

    // Exclude lesson if editing
    if (excludeLessonId) {
      query._id = { $ne: excludeLessonId };
    }

    // Find conflicting lessons
    const conflictingLesson = await Schedule.findOne(query)
      .populate('teacherId', 'firstName lastName')
      .lean();

    if (conflictingLesson) {
      // Get teacher name
      let teacherName = '';
      try {
        const teacher = await User.findById(teacherId).lean();
        teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Müəllim';
      } catch (e) {
        teacherName = 'Müəllim';
      }

      // Format the response with detailed conflict info
      return res.json({
        hasConflict: true,
        conflictingLesson: {
          id: conflictingLesson._id.toString(),
          startTime: conflictingLesson.startTime,
          endTime: conflictingLesson.endTime,
          date: conflictingLesson.date
        },
        message: `Müəllim "${teacherName}" bu tarixdə ${conflictingLesson.startTime}-${conflictingLesson.endTime} saatlari arasında başka bir dərsi mövcuddur. Eyni müəllim üçün eyni saatda dərs əlavə edilə bilməz.`
      });
    }

    // No conflict
    return res.json({
      hasConflict: false
    });
  } catch (error) {
    console.error('Teacher conflict check error:', error);
    res.status(500).json({ message: 'Müəllim üçün üst-üstə düşmə yoxlaması zamanı xəta baş verdi.' });
  }
};

// Öğretmen izin kontrolü
exports.checkTeacherLeave = async (req, res) => {
  try {
    const { teacherId, date } = req.body;

    // Zorunlu alanları kontrol et
    if (!teacherId || !date) {
      return res.status(400).json({
        message: 'Müəllim ID və tarix məlumatı lazımdır'
      });
    }

    // Öğretmenin var olup olmadığını kontrol et
    const User = require('../models/User');
    const teacher = await User.findById(teacherId);

    if (!teacher) {
      return res.status(404).json({
        message: 'Müəllim tapılmadı'
      });
    }

    // İzin kayıtlarını kontrol et
    const Leave = require('../models/Leave');
    const checkDate = new Date(date);

    // Tarih formatını düzelt (saat kısmını kaldır)
    checkDate.setHours(0, 0, 0, 0);

    // First, find all leave records for this teacher
    const leaveRecords = await Leave.find({
      teacherId,
      status: { $ne: 'rejected' } // Exclude rejected leave requests
    }).lean();

    // Check each leave record manually to implement custom logic
    let activeLeave = null;

    for (const record of leaveRecords) {
      const leaveStartDate = new Date(record.startDate);
      const leaveEndDate = new Date(record.endDate);

      // Reset time parts for consistent comparison
      leaveStartDate.setHours(0, 0, 0, 0);
      leaveEndDate.setHours(0, 0, 0, 0);

      // Don't allow scheduling on the start date (using strict > instead of >=)
      // For example, if leave is from 15th to 25th, we should block scheduling on 15th
      if (leaveStartDate.getTime() === checkDate.getTime() ||
          (checkDate > leaveStartDate && checkDate <= leaveEndDate)) {
        activeLeave = record;
        break;
      }
    }

    if (activeLeave) {
      // Format dates for display
      const startDateFormatted = new Date(activeLeave.startDate).toLocaleDateString('tr-TR');
      const endDateFormatted = new Date(activeLeave.endDate).toLocaleDateString('tr-TR');

      // Teacher is on leave
      const teacherName = `${teacher.firstName} ${teacher.lastName}`;
      return res.json({
        hasLeave: true,
        message: `${teacherName} bu tarixdə məzuniyyətdədir. Məzuniyyət səbəbi: ${activeLeave.reason}. Tarix aralığı: ${startDateFormatted} - ${endDateFormatted}`
      });
    }

    // Teacher is not on leave
    return res.json({
      hasLeave: false
    });
  } catch (error) {
    console.error('Müəllim icazə yoxlaması zamanı xəta baş verdi:', error);
    res.status(500).json({
      message: 'Müəllim icazə yoxlaması zamanı xəta baş verdi'
    });
  }
};

// Get all completed lessons
exports.getCompletedLessons = async (req, res) => {
  try {
    console.log('Getting completed lessons');

    // Find all lessons where isChecked is true
    const completedLessons = await Schedule.find({ isChecked: true })
      .populate('teacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    console.log(`Found ${completedLessons.length} completed lessons`);

    // Format the response - handle possible null values
    const formattedLessons = completedLessons.map(lesson => {
      // Ensure teacher exists before accessing properties
      const teacherId = lesson.teacherId ? lesson.teacherId._id.toString() : null;
      const teacherName = lesson.teacherId
        ? `${lesson.teacherId.firstName || ''} ${lesson.teacherId.lastName || ''}`.trim()
        : 'Unknown Teacher';

      // Ensure location exists
      const locationId = lesson.locationId ? lesson.locationId._id.toString() : null;
      const locationName = lesson.locationId ? lesson.locationId.name : 'Unknown Location';

      // Ensure courseType exists
      const courseTypeId = lesson.courseTypeId ? lesson.courseTypeId._id.toString() : null;
      const courseTypeName = lesson.courseTypeId ? lesson.courseTypeId.name : 'Unknown Type';

      return {
        id: lesson._id.toString(),
        teacherId,
        teacherName,
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
    console.log('Lesson teacherId:', schedule.teacherId.toString());

    // Only allow teacher to update their own lessons
    if (req.user && req.user.role === 'teacher' &&
        schedule.teacherId.toString() !== req.user.id.toString()) {
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
      .populate('teacherId', 'firstName lastName email')
      .populate('locationId', 'name')
      .populate('courseTypeId', 'name')
      .populate('seasonId', 'name')
      .lean();

    // Format the response - handle possible null values
    const formattedSchedule = {
      id: updatedSchedule._id.toString(),
      teacherId: updatedSchedule.teacherId ? updatedSchedule.teacherId._id.toString() : null,
      teacherName: updatedSchedule.teacherId
        ? `${updatedSchedule.teacherId.firstName || ''} ${updatedSchedule.teacherId.lastName || ''}`.trim()
        : 'Unknown Teacher',
      locationId: updatedSchedule.locationId ? updatedSchedule.locationId._id.toString() : null,
      locationName: updatedSchedule.locationId ? updatedSchedule.locationId.name : 'Unknown Location',
      courseTypeId: updatedSchedule.courseTypeId ? updatedSchedule.courseTypeId._id.toString() : null,
      type: updatedSchedule.courseTypeId ? updatedSchedule.courseTypeId.name : 'Unknown Type',
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
