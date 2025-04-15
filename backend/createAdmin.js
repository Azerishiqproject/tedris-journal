const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Admin user data
const adminData = {
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@admin.com',
  password: 'admin',
  role: 'admin'
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    console.log('Connected to database:', process.env.MONGODB_URI);
    createAdmin();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Create admin user (bypass password hashing in User model)
async function createAdmin() {
  try {
    // Drop existing users collection if exists
    try {
      // Only for development/testing purposes
      console.log('Removing existing users collection...');
      await mongoose.connection.collections.users?.drop();
      console.log('Users collection dropped');
    } catch (err) {
      console.log('No existing users collection to drop or error dropping:', err.message);
    }

    // Manually create user document to bypass pre-save hooks
    const result = await mongoose.connection.collection('users').insertOne({
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email,
      password: adminData.password, // Plain text password for testing
      role: adminData.role,
      createdAt: new Date()
    });

    console.log('Admin user created successfully with ID:', result.insertedId);

    // Display admin credentials
    console.log('Admin Credentials:');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);

    // Verify user was created
    const savedUser = await mongoose.connection.collection('users').findOne({ email: adminData.email });
    if (savedUser) {
      console.log('Verified: Admin user exists in database');
      console.log('User details:', {
        id: savedUser._id,
        email: savedUser.email,
        role: savedUser.role,
        password: savedUser.password // Show raw password for verification
      });
    } else {
      console.error('ERROR: Admin user was not found after creation!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}
