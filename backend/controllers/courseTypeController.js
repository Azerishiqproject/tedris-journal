const CourseType = require('../models/CourseType');

// Tüm kurs tiplerini getir
exports.getAllCourseTypes = async (req, res) => {
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

    const courseTypes = await CourseType.find(query).lean();

    // MongoDB _id'sini id'ye dönüştürme
    const formattedCourseTypes = courseTypes.map(courseType => ({
      ...courseType,
      id: courseType._id.toString()
    }));

    res.json({ courseTypes: formattedCourseTypes });
  } catch (error) {
    console.error('Get all course types error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// ID'ye göre kurs tipini getir
exports.getCourseTypeById = async (req, res) => {
  try {
    const courseType = await CourseType.findById(req.params.id);

    if (!courseType) {
      return res.status(404).json({ message: 'Kurs tipi bulunamadı.' });
    }

    // MongoDB _id'sini id'ye dönüştürme
    const formattedCourseType = {
      ...courseType.toObject(),
      id: courseType._id.toString()
    };

    res.json({ courseType: formattedCourseType });
  } catch (error) {
    console.error('Get course type error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Yeni kurs tipi oluştur
exports.createCourseType = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Zorunlu alanları kontrol et
    if (!name || !description) {
      return res.status(400).json({
        message: 'Kurs tipi adı ve açıklaması zorunludur.'
      });
    }

    // Kurs tipi oluştur
    const courseType = new CourseType({
      name,
      description
    });

    await courseType.save();

    // Format response
    const formattedCourseType = {
      ...courseType.toObject(),
      id: courseType._id.toString()
    };

    res.status(201).json({
      message: 'Kurs tipi başarıyla oluşturuldu.',
      courseType: formattedCourseType
    });
  } catch (error) {
    console.error('Create course type error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Kurs tipini güncelle
exports.updateCourseType = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Kurs tipinin var olup olmadığını kontrol et
    const courseType = await CourseType.findById(req.params.id);

    if (!courseType) {
      return res.status(404).json({ message: 'Kurs tipi bulunamadı.' });
    }

    // Zorunlu alanları kontrol et
    if ((name === '' || description === '')) {
      return res.status(400).json({
        message: 'Kurs tipi adı ve açıklaması boş olamaz.'
      });
    }

    // Alanları güncelle
    if (name !== undefined) courseType.name = name;
    if (description !== undefined) courseType.description = description;

    await courseType.save();

    // Format response
    const formattedCourseType = {
      ...courseType.toObject(),
      id: courseType._id.toString()
    };

    res.json({
      message: 'Kurs tipi başarıyla güncellendi.',
      courseType: formattedCourseType
    });
  } catch (error) {
    console.error('Update course type error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Kurs tipini sil
exports.deleteCourseType = async (req, res) => {
  try {
    const courseTypeId = req.params.id;

    // Ders tipinin programda kullanılıp kullanılmadığını kontrol et
    const Schedule = require('../models/Schedule');
    const scheduleWithCourseType = await Schedule.findOne({ courseTypeId });

    if (scheduleWithCourseType) {
      return res.status(400).json({
        message: 'Bu ders tipi programda kullanılıyor, silinemez.',
        inUse: true
      });
    }

    const courseType = await CourseType.findByIdAndDelete(courseTypeId);

    if (!courseType) {
      return res.status(404).json({ message: 'Ders tipi bulunamadı.' });
    }

    res.json({
      message: 'Ders tipi başarıyla silindi.',
      id: courseType._id.toString()
    });
  } catch (error) {
    console.error('Delete course type error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Ders tipi durumunu değiştir (admin only)
exports.toggleCourseTypeStatus = async (req, res) => {
  try {
    const courseTypeId = req.params.id;

    // Ders tipini bul
    const courseType = await CourseType.findById(courseTypeId);

    if (!courseType) {
      return res.status(404).json({ message: 'Dərs tipi tapılmadı.' });
    }

    // Durumu tersine çevir
    courseType.isActive = !courseType.isActive;

    await courseType.save();

    // Güncellenen ders tipini formatla
    const formattedCourseType = {
      ...courseType.toObject(),
      id: courseType._id.toString()
    };

    const statusText = courseType.isActive ? 'aktiv' : 'passiv';

    res.json({
      message: `Dərs tipi durumu ${statusText} olaraq dəyişdirildi.`,
      courseType: formattedCourseType
    });
  } catch (error) {
    console.error('Toggle course type status error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};
