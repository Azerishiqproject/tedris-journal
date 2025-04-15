const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');

// Debug middleware
const debugMiddleware = (req, res, next) => {
  console.log(`[Courses API] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
};

// Tüm kursları getir (public)
router.get('/', debugMiddleware, courseController.getAllCourses);

// ID'ye göre kurs getir (public)
router.get('/:id', debugMiddleware, courseController.getCourseById);

// Kurs oluştur (geçici olarak yetki kontrolü devre dışı)
router.post('/', debugMiddleware, courseController.createCourse);

// Kurs güncelle (geçici olarak yetki kontrolü devre dışı)
router.put('/:id', debugMiddleware, courseController.updateCourse);

// Kurs sil (geçici olarak yetki kontrolü devre dışı)
router.delete('/:id', debugMiddleware, courseController.deleteCourse);

// Kurs durumunu değiştir (geçici olarak yetki kontrolü devre dışı)
router.patch('/:id/toggle-status', debugMiddleware, courseController.toggleCourseStatus);

module.exports = router;
