const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl || req.url}`);
  next();
});

// Log environment variables
console.log('PORT:', process.env.PORT);

// CORS configuration
app.use(cors());

// Regular middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Connection string was:', process.env.MONGODB_URI);
  });

// Routes
app.get('/', (req, res) => {
  res.send('Tedris Journal API is running');
});

// Import routes
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const courseRoutes = require('./routes/courses');
const courseTypeRoutes = require('./routes/courseTypes');
const locationRoutes = require('./routes/locations');
const scheduleRoutes = require('./routes/schedules');
const leaveRoutes = require('./routes/leaves');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/course-types', courseTypeRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/leaves', leaveRoutes);

// Error handling middleware
app.use((err, req, res) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
