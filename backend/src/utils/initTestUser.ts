import User from '../models/User';
import { IUserDocument } from '@firevision/shared';

/**
 * Initialize Test User
 * Creates a default test user (role: User) if TEST_USER_USERNAME is set.
 * Skipped entirely when the env var is absent — opt-in only.
 */
async function initializeTestUser(): Promise<IUserDocument | null> {
  const username = process.env.TEST_USER_USERNAME;
  if (!username) return null; // opt-in: skip if not configured

  try {
    const email = process.env.TEST_USER_EMAIL || 'testuser@firevision.local';
    const password = process.env.TEST_USER_PASSWORD || 'TestUser123!';
    const channelListCode =
      process.env.TEST_USER_CHANNEL_LIST_CODE || (await (User as any).generateChannelListCode());

    const existing = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existing) {
      console.log('Test user already exists');
      return existing;
    }

    const testUser = new User({
      username,
      password,
      email,
      role: 'User',
      isActive: true,
      channelListCode,
    });

    await testUser.save();
    console.log('Test user created successfully');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Channel List Code: ${testUser.channelListCode}`);

    return testUser;
  } catch (error) {
    console.error('Error initializing test user:', (error as Error).message);
    return null;
  }
}

module.exports = { initializeTestUser };
export { initializeTestUser };
