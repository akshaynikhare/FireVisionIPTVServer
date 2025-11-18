const User = require('../models/User');

/**
 * Initialize Super Admin User
 * Creates a super admin user if it doesn't exist in the database
 * Uses credentials from environment variables
 */
async function initializeSuperAdmin() {
  try {
    const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMeNow123!';
    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@firevision.local';

    // Check if super admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { username: username },
        { email: email }
      ]
    });

    if (existingAdmin) {
      console.log('✅ Super Admin user already exists');

      // Update password if it has changed (for security updates)
      if (process.env.FORCE_UPDATE_ADMIN_PASSWORD === 'true') {
        existingAdmin.password = password;
        existingAdmin.role = 'Admin';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log('🔄 Super Admin password updated');
      }

      return existingAdmin;
    }

    // Generate unique playlist code
    const playlistCode = await User.generatePlaylistCode();

    // Create new super admin user
    const superAdmin = new User({
      username: username,
      password: password,
      email: email,
      role: 'Admin',
      isActive: true,
      playlistCode: playlistCode
    });

    await superAdmin.save();
    console.log('✅ Super Admin user created successfully');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Playlist Code: ${superAdmin.playlistCode}`);

    return superAdmin;
  } catch (error) {
    console.error('❌ Error initializing Super Admin:', error.message);
    throw error;
  }
}

module.exports = { initializeSuperAdmin };
