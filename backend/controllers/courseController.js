const Course = require('../models/Course');

// Tüm kursları getir
exports.getAllCourses = async (req, res) => {
  try {
    // status sorgu parametresi isteğe bağlı olarak alınabilir
    const { status } = req.query;

    // Temel sorgu
    const query = {};

    // Durum filtresini ekle (eğer varsa)
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const courses = await Course.find(query).lean();

    // MongoDB _id'sini id'ye dönüştürme
    const formattedCourses = courses.map(course => ({
      ...course,
      id: course._id.toString()
    }));

    res.json({ courses: formattedCourses });
  } catch (error) {
    console.error('Get all courses error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// ID'ye göre kurs getir
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Kurs bulunamadı.' });
    }

    // MongoDB _id'sini id'ye dönüştürme
    const formattedCourse = {
      ...course.toObject(),
      id: course._id.toString()
    };

    res.json({ course: formattedCourse });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Yeni kurs oluştur
exports.createCourse = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Kurs adının olup olmadığını kontrol et
    if (!name) {
      return res.status(400).json({ message: 'Kurs adı zorunludur.' });
    }

    // Kurs oluştur - sadeleştirilmiş
    const course = new Course({
      name,
      description: description || ''
    });

    await course.save();

    // Format response
    const formattedCourse = {
      ...course.toObject(),
      id: course._id.toString()
    };

    res.status(201).json({
      message: 'Kurs başarıyla oluşturuldu.',
      course: formattedCourse
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Kursu güncelle
exports.updateCourse = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Kursun var olup olmadığını kontrol et
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Kurs bulunamadı.' });
    }

    // Alanları güncelle - sadeleştirilmiş
    if (name) course.name = name;
    if (description !== undefined) course.description = description;

    await course.save();

    // Format response
    const formattedCourse = {
      ...course.toObject(),
      id: course._id.toString()
    };

    res.json({
      message: 'Kurs başarıyla güncellendi.',
      course: formattedCourse
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Kursu sil (admin only)
exports.deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id;

    // Kursun programda kullanılıp kullanılmadığını kontrol et
    const Schedule = require('../models/Schedule');
    const scheduleWithCourse = await Schedule.findOne({ courseId });

    if (scheduleWithCourse) {
      return res.status(400).json({
        message: 'Bu ders programda kullanılıyor, silinemez.',
        inUse: true
      });
    }

    const course = await Course.findByIdAndDelete(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Kurs bulunamadı.' });
    }

    res.json({
      message: 'Kurs başarıyla silindi.',
      id: course._id.toString()
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Ders durumunu değiştir (admin only)
exports.toggleCourseStatus = async (req, res) => {
  try {
    const courseId = req.params.id;

    // Dersi bul
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Dərs tapılmadı.' });
    }

    // Durumu tersine çevir
    course.isActive = !course.isActive;

    await course.save();

    // Güncellenen dersi formatla
    const formattedCourse = {
      ...course.toObject(),
      id: course._id.toString()
    };

    const statusText = course.isActive ? 'aktiv' : 'passiv';

    res.json({
      message: `Dərs durumu ${statusText} olaraq dəyişdirildi.`,
      course: formattedCourse
    });
  } catch (error) {
    console.error('Toggle course status error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};
