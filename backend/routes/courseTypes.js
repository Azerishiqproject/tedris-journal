const express = require('express');
const router = express.Router();
const courseTypeController = require('../controllers/courseTypeController');

// Debug middleware
const debugMiddleware = (req, res, next) => {
  console.log(`[CourseTypes API] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
};

// Tüm kurs tiplerini getir (public)
router.get('/', debugMiddleware, courseTypeController.getAllCourseTypes);

// ID'ye göre kurs tipini getir (public)
router.get('/:id', debugMiddleware, courseTypeController.getCourseTypeById);

// Kurs tipi oluştur (geliştirme aşamasında yetki kontrolü devre dışı)
router.post('/', debugMiddleware, courseTypeController.createCourseType);

// Kurs tipini güncelle (geliştirme aşamasında yetki kontrolü devre dışı)
router.put('/:id', debugMiddleware, courseTypeController.updateCourseType);

// Kurs tipini sil (geliştirme aşamasında yetki kontrolü devre dışı)
router.delete('/:id', debugMiddleware, courseTypeController.deleteCourseType);

// Kurs tipi durumunu değiştir (geliştirme aşamasında yetki kontrolü devre dışı)
router.patch('/:id/toggle-status', debugMiddleware, courseTypeController.toggleCourseTypeStatus);

module.exports = router;
