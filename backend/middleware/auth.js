const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  console.log('Auth middleware running');

  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log('Token received:', token ? `${token.substring(0, 15)}...` : 'none');

  // Check if no token
  if (!token) {
    console.log('No token provided, access denied');
    return res.status(401).json({ message: 'Erişim reddedildi. Token yok.' });
  }

  try {
    // Verify token
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified successfully. User:', decoded.email, 'Role:', decoded.role);

    // Add user from payload
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ message: 'Geçersiz token.' });
  }
};
