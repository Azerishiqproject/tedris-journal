const User = require('../models/User');

// Get all teachers
exports.getAllTeachers = async (req, res) => {
  try {
    // isActive sorgu parametresi isteğe bağlı olarak alınabilir,
    // parametre yoksa veya 'all' ise tüm öğretmenleri getir
    const { status } = req.query;

    // Temel sorgu
    const query = { role: 'teacher' };

    // Durum filtresini ekle (eğer varsa)
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const teachers = await User.find(query).select('-password');
    res.json({ teachers });
  } catch (error) {
    console.error('Get all teachers error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Get teacher by ID
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await User.findOne({
      _id: req.params.id,
      role: 'teacher'
    }).select('-password');

    if (!teacher) {
      return res.status(404).json({ message: 'Müəllim tapılmadı.' });
    }

    res.json({ teacher });
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Create a new teacher (admin only)
exports.createTeacher = async (req, res) => {
  try {
    const { firstName, lastName, email, password, specialty, academicDegree } = req.body;

    // Check if teacher already exists
    const existingTeacher = await User.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor.' });
    }

    // Create new teacher
    const teacher = new User({
      firstName,
      lastName,
      email,
      password,
      role: 'teacher',
      specialty,
      academicDegree
    });

    await teacher.save();

    // Return teacher data without password
    const teacherData = {
      id: teacher._id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      role: teacher.role,
      specialty: teacher.specialty,
      academicDegree: teacher.academicDegree
    };

    res.status(201).json({
      message: 'Müəllim ugurla yaradıldı.',
      teacher: teacherData
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Update teacher (admin only)
exports.updateTeacher = async (req, res) => {
  try {
    const { firstName, lastName, email, specialty, academicDegree, password } = req.body;

    // Find teacher
    const teacher = await User.findOne({
      _id: req.params.id,
      role: 'teacher'
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Müəllim tapılmadı.' });
    }

    // Check if email is taken by another user
    if (email && email !== teacher.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor.' });
      }
    }

    // Update fields
    if (firstName) teacher.firstName = firstName;
    if (lastName) teacher.lastName = lastName;
    if (email) teacher.email = email;
    if (specialty) teacher.specialty = specialty;
    if (academicDegree) teacher.academicDegree = academicDegree;
    if (password) teacher.password = password; // Will be hashed by pre-save hook

    await teacher.save();

    // Return updated teacher data without password
    const teacherData = {
      id: teacher._id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      role: teacher.role,
      specialty: teacher.specialty,
      academicDegree: teacher.academicDegree
    };

    res.json({
      message: 'Müəllim ugurla yenilendi.',
      teacher: teacherData
    });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Delete teacher (admin only)
exports.deleteTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;

    // Öğretmenin programda kullanılıp kullanılmadığını kontrol et
    const Schedule = require('../models/Schedule');
    const scheduleWithTeacher = await Schedule.findOne({ teacherId });

    if (scheduleWithTeacher) {
      return res.status(400).json({
        message: 'Bu müəllim programda istifadə olunur, silinə bilməz.',
        inUse: true
      });
    }

    const teacher = await User.findByIdAndDelete(teacherId);

    if (!teacher) {
      return res.status(404).json({ message: 'Müəllim tapılmadı.' });
    }

    res.json({
      message: 'Müəllim ugurla silindi.',
      id: teacher._id.toString()
    });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Toggle teacher active status (admin only)
exports.toggleTeacherStatus = async (req, res) => {
  try {
    const teacherId = req.params.id;

    // Öğretmeni bul
    const teacher = await User.findOne({
      _id: teacherId,
      role: 'teacher'
    });

    if (!teacher) {
      return res.status(404).json({ message: 'Müəllim tapılmadı.' });
    }

    // Durumu tersine çevir
    teacher.isActive = !teacher.isActive;

    await teacher.save();

    // Return updated teacher data without password
    const teacherData = {
      id: teacher._id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      role: teacher.role,
      specialty: teacher.specialty,
      academicDegree: teacher.academicDegree,
      isActive: teacher.isActive
    };

    const statusText = teacher.isActive ? 'aktiv' : 'passiv';

    res.json({
      message: `Müəllim durumu ${statusText} olaraq dəyişdirildi.`,
      teacher: teacherData
    });
  } catch (error) {
    console.error('Toggle teacher status error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};
