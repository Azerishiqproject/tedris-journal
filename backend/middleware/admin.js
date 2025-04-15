module.exports = (req, res, next) => {
  // Check if user role is admin
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Erişim reddedildi. Admin yetkisi gerekiyor.' });
  }
};
