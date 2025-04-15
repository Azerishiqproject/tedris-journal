const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');

// Debug middleware
const debugMiddleware = (req, res, next) => {
  console.log(`[Leaves API] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
};

// Tüm izinleri getir
router.get('/', debugMiddleware, leaveController.getAllLeaves);

// Kullanıcının izinlerini getir
router.get('/user/:userId', debugMiddleware, leaveController.getUserLeaves);

// ID'ye göre izin getir
router.get('/:id', debugMiddleware, leaveController.getLeaveById);

// İzin oluştur
router.post('/', debugMiddleware, leaveController.createLeave);

// İzin güncelle
router.put('/:id', debugMiddleware, leaveController.updateLeave);

// İzin sil
router.delete('/:id', debugMiddleware, leaveController.deleteLeave);

module.exports = router;
