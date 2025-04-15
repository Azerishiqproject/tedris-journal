const Leave = require('../models/Leave');
const User = require('../models/User');
const Schedule = require('../models/Schedule');

// Tüm izinleri getir
exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find().lean();

    // Kullanıcı bilgilerini ekle
    const populatedLeaves = await Promise.all(leaves.map(async (leave) => {
      const user = await User.findById(leave.teacherId).lean();

      return {
        ...leave,
        id: leave._id.toString(),
        userName: user ? `${user.firstName} ${user.lastName}` : 'Bilinmeyen Kullanıcı',
        userRole: user ? user.role : 'unknown'
      };
    }));

    res.json({ leaves: populatedLeaves });
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Kullanıcının izinlerini getir
exports.getUserLeaves = async (req, res) => {
  try {
    const teacherId = req.params.userId;
    const leaves = await Leave.find({ teacherId }).lean();

    // Format the response
    const formattedLeaves = leaves.map(leave => ({
      ...leave,
      id: leave._id.toString()
    }));

    res.json({ leaves: formattedLeaves });
  } catch (error) {
    console.error('Get user leaves error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// ID'ye göre izin getir
exports.getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ message: 'İzin kaydı bulunamadı.' });
    }

    // Kullanıcı bilgilerini ekle
    const user = await User.findById(leave.teacherId).lean();

    // Format the response
    const formattedLeave = {
      ...leave.toObject(),
      id: leave._id.toString(),
      userName: user ? `${user.firstName} ${user.lastName}` : 'Bilinmeyen Kullanıcı',
      userRole: user ? user.role : 'unknown'
    };

    res.json({ leave: formattedLeave });
  } catch (error) {
    console.error('Get leave error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Yeni izin oluştur
exports.createLeave = async (req, res) => {
  try {
    const { teacherId, startDate, endDate, reason, notes } = req.body;

    // Zorunlu alanları kontrol et
    if (!teacherId || !startDate || !endDate || !reason) {
      return res.status(400).json({
        message: 'Kullanıcı, başlangıç tarixi, bitiş tarixi ve sebep alanları zorunludur.'
      });
    }

    // Tarihleri kontrol et
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({
        message: 'Başlangıç tarixi bitiş tarixindən sonra ola bilməz.'
      });
    }

    // Kullanıcı var mı kontrol et
    const user = await User.findById(teacherId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    // İzinli günlerde ders planlaması var mı kontrol et
    const schedules = await Schedule.find({
      teacherId,
      date: { $gte: start, $lte: end }
    });

    if (schedules.length > 0) {
      return res.status(400).json({
        message: 'Bu tarix aralığında istifadəçinin dərs programı var.',
        conflicts: schedules.map(s => s.date)
      });
    }

    // İzin oluştur
    const leave = new Leave({
      teacherId,
      startDate: start,
      endDate: end,
      reason,
      notes
    });

    await leave.save();

    // Format response
    const formattedLeave = {
      ...leave.toObject(),
      id: leave._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role
    };

    res.status(201).json({
      message: 'İzin başarıyla oluşturuldu.',
      leave: formattedLeave
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// İzin güncelle
exports.updateLeave = async (req, res) => {
  try {
    const { startDate, endDate, reason, notes, status } = req.body;

    // İznin var olup olmadığını kontrol et
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ message: 'İzin bulunamadı.' });
    }

    // Şimdiki zamanı ve izin başlangıç zamanını kontrol et
    const now = new Date();
    const leaveStartDate = new Date(leave.startDate);

    if (status === 'rejected' && leaveStartDate < now) {
      return res.status(400).json({
        message: 'Başlamış bir izin reddedilemez.'
      });
    }

    // Alanları güncelle
    if (startDate !== undefined) leave.startDate = new Date(startDate);
    if (endDate !== undefined) leave.endDate = new Date(endDate);
    if (reason !== undefined) leave.reason = reason;
    if (notes !== undefined) leave.notes = notes;
    if (status !== undefined) leave.status = status;

    // Tarihleri kontrol et
    if (leave.startDate > leave.endDate) {
      return res.status(400).json({
        message: 'Başlangıç tarixi bitiş tarixindən sonra ola bilməz.'
      });
    }

    // Kullanıcı bilgilerini al
    const user = await User.findById(leave.teacherId).lean();

    await leave.save();

    // Format response
    const formattedLeave = {
      ...leave.toObject(),
      id: leave._id.toString(),
      userName: user ? `${user.firstName} ${user.lastName}` : 'Bilinmeyen Kullanıcı',
      userRole: user ? user.role : 'unknown'
    };

    res.json({
      message: 'İzin başarıyla güncellendi.',
      leave: formattedLeave
    });
  } catch (error) {
    console.error('Update leave error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// İzin sil
exports.deleteLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;

    // İznin var olup olmadığını kontrol et
    const leave = await Leave.findById(leaveId);

    if (!leave) {
      return res.status(404).json({ message: 'İzin bulunamadı.' });
    }

    // Şimdiki zamanı ve izin başlangıç zamanını kontrol et
    const now = new Date();
    const leaveStartDate = new Date(leave.startDate);

    if (leaveStartDate < now && leave.status === 'approved') {
      return res.status(400).json({
        message: 'Təsdiqlənmiş və başlamış bir izin silinə bilməz.'
      });
    }

    await Leave.findByIdAndDelete(leaveId);

    res.json({
      message: 'İzin başarıyla silindi.',
      id: leaveId
    });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};
