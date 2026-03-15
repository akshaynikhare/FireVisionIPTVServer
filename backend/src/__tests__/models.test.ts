import Channel from '../models/Channel';
import AppVersion from '../models/AppVersion';
import User from '../models/User';

describe('Channel model', () => {
  it('should create a channel with required fields', async () => {
    const channel = new Channel({
      channelId: 'ch-001',
      channelName: 'Test Channel',
      channelUrl: 'http://example.com/stream.m3u8',
    });
    const saved: any = await channel.save();
    expect(saved._id).toBeDefined();
    expect(saved.channelName).toBe('Test Channel');
    expect(saved.channelGroup).toBe('Uncategorized');
  });

  it('should fail without required fields', async () => {
    const channel = new Channel({});
    await expect(channel.save()).rejects.toThrow();
  });

  it('should generate M3U format', async () => {
    const channel: any = new Channel({
      channelId: 'ch-002',
      channelName: 'News Channel',
      channelUrl: 'http://example.com/news.m3u8',
      channelImg: 'http://example.com/logo.png',
      channelGroup: 'News',
    });
    await channel.save();
    const m3u = channel.toM3U();
    expect(m3u).toContain('#EXTINF');
    expect(m3u).toContain('News Channel');
    expect(m3u).toContain('http://example.com/news.m3u8');
  });
});

describe('AppVersion model', () => {
  it('should create an app version', async () => {
    const version = new AppVersion({
      versionName: '1.0.0',
      versionCode: 1,
      apkFileName: 'app-v1.0.0.apk',
      apkFileSize: 1024000,
      downloadUrl: '/downloads/app-v1.0.0.apk',
    });
    const saved: any = await version.save();
    expect(saved.versionCode).toBe(1);
    expect(saved.isActive).toBe(true);
    expect(saved.isMandatory).toBe(false);
  });
});

describe('User model', () => {
  it('should hash password on save', async () => {
    const code = await (User as any).generateChannelListCode();
    const user = new User({
      username: 'testuser',
      password: 'plaintext123',
      email: 'test@example.com',
      channelListCode: code,
    });
    const saved: any = await user.save();
    expect(saved.password).not.toBe('plaintext123');
    expect(saved.password).toMatch(/^\$2[aby]?\$/);
  });

  it('should compare password correctly', async () => {
    const code = await (User as any).generateChannelListCode();
    const user: any = new User({
      username: 'testuser2',
      password: 'mypassword',
      email: 'test2@example.com',
      channelListCode: code,
    });
    await user.save();
    const isMatch = await user.comparePassword('mypassword');
    expect(isMatch).toBe(true);
    const isWrong = await user.comparePassword('wrong');
    expect(isWrong).toBe(false);
  });

  it('should generate a channel list code', async () => {
    const code = await (User as any).generateChannelListCode();
    expect(code).toBeDefined();
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
  });
});
