const express = require('express');
const router = express.Router();
const seasonController = require('../controllers/seasonController');

// Debug middleware
const debugMiddleware = (req, res, next) => {
  console.log(`[Seasons API] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  next();
};

// Tüm sezonları getir (public)
router.get('/', debugMiddleware, seasonController.getAllSeasons);

// ID'ye göre sezon getir (public)
router.get('/:id', debugMiddleware, seasonController.getSeasonById);

// Sezon oluştur (geçici olarak yetki kontrolü devre dışı)
router.post('/', debugMiddleware, seasonController.createSeason);

// Sezon güncelle (geçici olarak yetki kontrolü devre dışı)
router.put('/:id', debugMiddleware, seasonController.updateSeason);

// Sezon sil (geçici olarak yetki kontrolü devre dışı)
router.delete('/:id', debugMiddleware, seasonController.deleteSeason);

// Sezon durumunu değiştir (geçici olarak yetki kontrolü devre dışı)
router.patch('/:id/toggle-status', debugMiddleware, seasonController.toggleSeasonStatus);

module.exports = router;
