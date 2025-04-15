const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Debug middleware
router.use((req, res, next) => {
  console.log(`[Teachers API] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// Admin-only routes
router.post('/', adminMiddleware, teacherController.createTeacher);
router.put('/:id', adminMiddleware, teacherController.updateTeacher);
router.delete('/:id', adminMiddleware, teacherController.deleteTeacher);
router.patch('/:id/toggle-status', adminMiddleware, teacherController.toggleTeacherStatus);

// Routes accessible by both admin and teachers
router.get('/', teacherController.getAllTeachers);
router.get('/:id', teacherController.getTeacherById);

module.exports = router;
