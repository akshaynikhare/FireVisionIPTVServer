const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Initialize Super Admin User
 * This script creates a super admin user if one doesn't exist
 * Credentials are read from environment variables
 */
async function initializeAdmin() {
  try {
    // Get admin credentials from environment
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@firevision.local';

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      $or: [
        { username: adminUsername },
        { email: adminEmail }
      ]
    });

    if (existingAdmin) {
      console.log('✓ Super admin user already exists');
      console.log(`  Username: ${existingAdmin.username}`);
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Role: ${existingAdmin.role}`);
      return existingAdmin;
    }

    // Generate playlist code for admin
    const playlistCode = await User.generatePlaylistCode();

    // Create super admin user
    const adminUser = new User({
      username: adminUsername,
      password: adminPassword,
      email: adminEmail,
      role: 'Admin',
      playlistCode: playlistCode,
      isActive: true,
      authProvider: 'local'
    });

    await adminUser.save();

    console.log('✓ Super admin user created successfully');
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Playlist Code: ${playlistCode}`);
    console.log('  ⚠ IMPORTANT: Change the default password immediately!');

    return adminUser;

  } catch (error) {
    console.error('✗ Error initializing admin user:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';

  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      return initializeAdmin();
    })
    .then(() => {
      console.log('Admin initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to initialize admin:', error);
      process.exit(1);
    });
}

module.exports = initializeAdmin;
