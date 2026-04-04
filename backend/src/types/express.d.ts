declare namespace Express {
  interface Request {
    user?: {
      id: string;
      username: string;
      email: string;
      role: 'Admin' | 'User';
      channels?: unknown[];
      channelListCode?: string;
      isActive: boolean;
      emailVerified: boolean;
    };
    sessionId?: string;
    jwt?: {
      sub: string;
      role: string;
      channelListCode?: string;
      jti?: string;
      iat?: number;
      exp?: number;
    };
    userId?: string;
  }
}
