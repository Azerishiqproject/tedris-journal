const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const protect = require('../middleware/auth');

// Debug middleware
const debugMiddleware = (req, res, next) => {
  console.log(`[Schedule API] ${req.method} ${req.originalUrl}`);
  console.log('Request Body:', req.body);
  next();
};

// Tüm ders programını getir
router.get('/', debugMiddleware, scheduleController.getAllSchedules);

// ID'ye göre ders programı kaydını getir
router.get('/:id', debugMiddleware, scheduleController.getScheduleById);

// Öğretmen çakışma kontrolü
router.post('/check-teacher-conflict',
  debugMiddleware,
  protect, // JWT doğrulama
  scheduleController.checkTeacherConflict
);

// Öğretmen izin kontrolü
router.post('/check-teacher-leave', scheduleController.checkTeacherLeave);

// Yeni ders programı kaydı oluştur
router.post('/',
  debugMiddleware,
  protect, // JWT doğrulama
  scheduleController.createSchedule
);

// Ders programı kaydını güncelle
router.put('/:id',
  debugMiddleware,
  protect, // JWT doğrulama
  scheduleController.updateSchedule
);

// Ders programı kaydını sil
router.delete('/:id',
  debugMiddleware,
  protect, // JWT doğrulama
  scheduleController.deleteSchedule
);

module.exports = router;
