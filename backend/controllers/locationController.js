const Location = require('../models/Location');

// Tüm mekanları getir
exports.getAllLocations = async (req, res) => {
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

    const locations = await Location.find(query).lean();

    // MongoDB _id'sini id'ye dönüştürme
    const formattedLocations = locations.map(location => ({
      ...location,
      id: location._id.toString()
    }));

    res.json({ locations: formattedLocations });
  } catch (error) {
    console.error('Get all locations error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// ID'ye göre mekanı getir
exports.getLocationById = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({ message: 'Mekan bulunamadı.' });
    }

    // MongoDB _id'sini id'ye dönüştürme
    const formattedLocation = {
      ...location.toObject(),
      id: location._id.toString()
    };

    res.json({ location: formattedLocation });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Yeni mekan oluştur
exports.createLocation = async (req, res) => {
  try {
    const { name, description } = req.body;

    // İsim alanını kontrol et
    if (!name) {
      return res.status(400).json({
        message: 'Mekan adı zorunludur.'
      });
    }

    // Mekan oluştur
    const location = new Location({
      name,
      description
    });

    await location.save();

    // Format response
    const formattedLocation = {
      ...location.toObject(),
      id: location._id.toString()
    };

    res.status(201).json({
      message: 'Mekan başarıyla oluşturuldu.',
      location: formattedLocation
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Mekanı güncelle
exports.updateLocation = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Mekanın var olup olmadığını kontrol et
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({ message: 'Mekan bulunamadı.' });
    }

    // İsim alanını kontrol et
    if (name === '') {
      return res.status(400).json({
        message: 'Mekan adı boş olamaz.'
      });
    }

    // Alanları güncelle
    if (name !== undefined) location.name = name;
    if (description !== undefined) location.description = description;

    await location.save();

    // Format response
    const formattedLocation = {
      ...location.toObject(),
      id: location._id.toString()
    };

    res.json({
      message: 'Mekan başarıyla güncellendi.',
      location: formattedLocation
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Ders yerini sil
exports.deleteLocation = async (req, res) => {
  try {
    const locationId = req.params.id;

    // Ders yerinin programda kullanılıp kullanılmadığını kontrol et
    const Schedule = require('../models/Schedule');
    const scheduleWithLocation = await Schedule.findOne({ locationId });

    if (scheduleWithLocation) {
      return res.status(400).json({
        message: 'Bu ders yeri programda kullanılıyor, silinemez.',
        inUse: true
      });
    }

    const location = await Location.findByIdAndDelete(locationId);

    if (!location) {
      return res.status(404).json({ message: 'Ders yeri bulunamadı.' });
    }

    res.json({
      message: 'Ders yeri başarıyla silindi.',
      id: location._id.toString()
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Ders yeri durumunu değiştir (admin only)
exports.toggleLocationStatus = async (req, res) => {
  try {
    const locationId = req.params.id;

    // Ders yerini bul
    const location = await Location.findById(locationId);

    if (!location) {
      return res.status(404).json({ message: 'Dərs yeri tapılmadı.' });
    }

    // Durumu tersine çevir
    location.isActive = !location.isActive;

    await location.save();

    // Güncellenen ders yerini formatla
    const formattedLocation = {
      ...location.toObject(),
      id: location._id.toString()
    };

    const statusText = location.isActive ? 'aktiv' : 'passiv';

    res.json({
      message: `Dərs yeri durumu ${statusText} olaraq dəyişdirildi.`,
      location: formattedLocation
    });
  } catch (error) {
    console.error('Toggle location status error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};
