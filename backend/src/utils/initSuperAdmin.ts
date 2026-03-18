import User from '../models/User';
import { IUserDocument } from '@firevision/shared';

/**
 * Initialize Super Admin User
 * Creates a super admin user if it doesn't exist in the database
 * Uses credentials from environment variables
 */
async function initializeSuperAdmin(): Promise<IUserDocument> {
  try {
    const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@firevision.local';

    if (!process.env.SUPER_ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
      throw new Error('SUPER_ADMIN_PASSWORD must be set in production');
    }
    const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMeNow123!';
    const channelListCode =
      process.env.SUPER_ADMIN_CHANNEL_LIST_CODE || (await (User as any).generateChannelListCode());

    // Check if super admin already exists (by configured username/email)
    let existingAdmin = await User.findOne({
      $or: [{ username: username }, { email: email }],
    });

    // Fallback: find any existing Admin user (handles credential migration)
    if (!existingAdmin) {
      existingAdmin = await User.findOne({ role: 'Admin' });
      if (existingAdmin) {
        console.log(`Super Admin found by role (${existingAdmin.username}) — updating credentials`);
        existingAdmin.username = username;
        existingAdmin.email = email;
        existingAdmin.password = password;
        existingAdmin.isActive = true;
        existingAdmin.channelListCode = channelListCode;
        await existingAdmin.save();
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);
        return existingAdmin;
      }
    }

    if (existingAdmin) {
      console.log('Super Admin user already exists');

      // Update password, role, and channel list code if needed
      if (process.env.FORCE_UPDATE_ADMIN_PASSWORD === 'true') {
        existingAdmin.password = password;
        existingAdmin.role = 'Admin';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log('Super Admin password updated');
      }

      // Update channel list code if environment variable is set and different
      if (
        process.env.SUPER_ADMIN_CHANNEL_LIST_CODE &&
        existingAdmin.channelListCode !== channelListCode
      ) {
        existingAdmin.channelListCode = channelListCode;
        await existingAdmin.save();
        console.log(`Super Admin channel list code updated to: ${channelListCode}`);
      }

      return existingAdmin;
    }

    // Create new super admin user
    const superAdmin = new User({
      username: username,
      password: password,
      email: email,
      role: 'Admin',
      isActive: true,
      channelListCode: channelListCode,
    });

    await superAdmin.save();
    console.log('Super Admin user created successfully');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Channel List Code: ${superAdmin.channelListCode}`);

    return superAdmin;
  } catch (error) {
    console.error('Error initializing Super Admin:', (error as Error).message);
    throw error;
  }
}

module.exports = { initializeSuperAdmin };
export { initializeSuperAdmin };
