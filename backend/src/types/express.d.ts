declare namespace Express {
  interface Request {
    user?: {
      id: string;
      username: string;
      email: string;
      role: 'Admin' | 'User';
      playlistCode?: string;
      isActive: boolean;
      emailVerified: boolean;
    };
    sessionId?: string;
    jwt?: {
      sub: string;
      role: string;
      playlistCode?: string;
      jti?: string;
      iat?: number;
      exp?: number;
    };
    userId?: string;
  }
}
