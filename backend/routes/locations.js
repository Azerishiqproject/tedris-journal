const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// Debug middleware
const debugMiddleware = (req, res, next) => {
  console.log(`[Locations API] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
};

// Tüm mekanları getir (public)
router.get('/', debugMiddleware, locationController.getAllLocations);

// ID'ye göre mekanı getir (public)
router.get('/:id', debugMiddleware, locationController.getLocationById);

// Mekan oluştur (geliştirme aşamasında yetki kontrolü devre dışı)
router.post('/', debugMiddleware, locationController.createLocation);

// Mekanı güncelle (geliştirme aşamasında yetki kontrolü devre dışı)
router.put('/:id', debugMiddleware, locationController.updateLocation);

// Mekanı sil (geliştirme aşamasında yetki kontrolü devre dışı)
router.delete('/:id', debugMiddleware, locationController.deleteLocation);

// Mekan durumunu değiştir (geliştirme aşamasında yetki kontrolü devre dışı)
router.patch('/:id/toggle-status', debugMiddleware, locationController.toggleLocationStatus);

module.exports = router;
