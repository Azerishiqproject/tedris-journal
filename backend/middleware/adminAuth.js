/**
 * Admin yetkilendirme middleware
 * Kullanıcının admin rolüne sahip olup olmadığını kontrol eder
 */
const adminAuth = (req, res, next) => {
  try {
    // Kullanıcı yetkilendirme middleware'inden geçtikten sonra req.user olması gerekiyor
    if (!req.user) {
      return res.status(401).json({ message: 'Yetkilendirme başarısız. Lütfen giriş yapın.' });
    }

    // Admin yetkisini kontrol et
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için admin yetkisi gereklidir.' });
    }

    // Admin yetkisine sahipse, bir sonraki middleware'e geç
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

module.exports = adminAuth;
