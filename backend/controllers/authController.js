const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (user) => {
  console.log('Generating token for user:', user.email);
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

  // Make sure user id is a string
  const userId = user._id.toString();
  console.log('User ID type:', typeof userId);

  // Güvenlik için: JWT_SECRET yoksa varsayılan bir anahtar kullan
  const secret = process.env.JWT_SECRET || 'fallback_jwt_secret_for_development';

  try {
    const token = jwt.sign(
      { id: userId, email: user.email, role: user.role },
      secret,
      { expiresIn: '7d' }
    );
    console.log('Token generated successfully');
    return token;
  } catch (error) {
    console.error('Token generation error:', error);
    throw error;
  }
};

// Register a new user
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, specialty, academicDegree } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor.' });
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role: role || 'teacher',
      specialty,
      academicDegree
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    // Return user data without password
    const userData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      specialty: user.specialty,
      academicDegree: user.academicDegree
    };

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    console.log('Login request received:', {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body
    });

    const { email, password } = req.body;

    // Check if data is missing
    if (!email || !password) {
      console.log('Login failed: Missing email or password');
      return res.status(400).json({ message: 'Email ve şifre gereklidir.' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login failed: User not found for email', email);
      return res.status(401).json({ message: 'Geçersiz email veya şifre.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Login failed: Invalid password for email', email);
      return res.status(401).json({ message: 'Geçersiz email veya şifre.' });
    }

    // Generate token
    const token = generateToken(user);

    // Return user data without password
    const userData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      specialty: user.specialty,
      academicDegree: user.academicDegree
    };

    console.log('Login successful for user:', userData.email);

    res.json({ user: userData, token });
  } catch (error) {
    console.error('Login error details:', error);
    res.status(500).json({ message: 'Sunucu hatası.', error: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    // req.user comes from auth middleware
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Sunucu hatası.' });
  }
};

// Logout user
exports.logout = async (req, res) => {
  try {
    // JWT token zaten istemci tarafında silinecek
    res.status(200).json({ message: 'Başarıyla çıkış yapıldı.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Çıkış yapılırken bir hata oluştu.' });
  }
};
