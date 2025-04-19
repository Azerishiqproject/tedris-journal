const Season = require('../models/Season');

// Tüm sezonları getir
exports.getAllSeasons = async (req, res) => {
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

    const seasons = await Season.find(query).lean();

    // MongoDB _id'sini id'ye dönüştürme
    const formattedSeasons = seasons.map(season => ({
      ...season,
      id: season._id.toString()
    }));

    res.json({ seasons: formattedSeasons });
  } catch (error) {
    console.error('Get all seasons error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// ID'ye göre sezon getir
exports.getSeasonById = async (req, res) => {
  try {
    const season = await Season.findById(req.params.id);

    if (!season) {
      return res.status(404).json({ message: 'Sezon bulunamadı.' });
    }

    // MongoDB _id'sini id'ye dönüştürme
    const formattedSeason = {
      ...season.toObject(),
      id: season._id.toString()
    };

    res.json({ season: formattedSeason });
  } catch (error) {
    console.error('Get season error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Yeni sezon oluştur
exports.createSeason = async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    // Sezon adının olup olmadığını kontrol et
    if (!name) {
      return res.status(400).json({ message: 'Sezon adı zorunludur.' });
    }

    // Sezon oluştur
    const season = new Season({
      name,
      description: description || '',
      startDate: startDate || null,
      endDate: endDate || null
    });

    await season.save();

    // Format response
    const formattedSeason = {
      ...season.toObject(),
      id: season._id.toString()
    };

    res.status(201).json({
      message: 'Sezon başarıyla oluşturuldu.',
      season: formattedSeason
    });
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Sezonu güncelle
exports.updateSeason = async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    // Sezonun var olup olmadığını kontrol et
    const season = await Season.findById(req.params.id);

    if (!season) {
      return res.status(404).json({ message: 'Sezon bulunamadı.' });
    }

    // Alanları güncelle
    if (name) season.name = name;
    if (description !== undefined) season.description = description;
    if (startDate !== undefined) season.startDate = startDate;
    if (endDate !== undefined) season.endDate = endDate;

    await season.save();

    // Format response
    const formattedSeason = {
      ...season.toObject(),
      id: season._id.toString()
    };

    res.json({
      message: 'Sezon başarıyla güncellendi.',
      season: formattedSeason
    });
  } catch (error) {
    console.error('Update season error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Sezonu sil
exports.deleteSeason = async (req, res) => {
  try {
    const seasonId = req.params.id;

    // Find the season first
    const season = await Season.findById(seasonId);

    if (!season) {
      return res.status(404).json({ message: 'Sezon bulunamadı.' });
    }

    try {
      // First try with remove() method (for older mongoose versions)
      await season.remove();
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('remove is not a function')) {
        // If remove() is not available, use findByIdAndDelete
        await Season.findByIdAndDelete(seasonId);
      } else {
        // If it's a different error, rethrow it
        throw err;
      }
    }

    res.json({
      message: 'Sezon başarıyla silindi. Sezona bağlı tüm dersler de silindi.',
      id: seasonId
    });
  } catch (error) {
    console.error('Delete season error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Sezon durumunu değiştir
exports.toggleSeasonStatus = async (req, res) => {
  try {
    const seasonId = req.params.id;

    // Sezonu bul
    const season = await Season.findById(seasonId);

    if (!season) {
      return res.status(404).json({ message: 'Sezon tapılmadı.' });
    }

    // Durumu tersine çevir
    const oldStatus = season.isActive;
    season.isActive = !oldStatus;

    await season.save();

    // Güncellenen sezonu formatla
    const formattedSeason = {
      ...season.toObject(),
      id: season._id.toString()
    };

    const statusText = season.isActive ? 'aktiv' : 'passiv';

    // Get count of lessons affected by this change
    const Schedule = require('../models/Schedule');
    const lessonsCount = await Schedule.countDocuments({ seasonId });

    res.json({
      message: `Sezon durumu ${statusText} olaraq dəyişdirildi.${lessonsCount > 0 ? ` Bu değişiklik ${lessonsCount} dərsi etkileyecek.` : ''}`,
      season: formattedSeason,
      lessonsAffected: lessonsCount > 0,
      lessonsCount,
      shouldRefreshLessons: true
    });
  } catch (error) {
    console.error('Toggle season status error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};
