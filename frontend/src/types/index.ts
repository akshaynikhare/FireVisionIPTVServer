// Re-export types from shared package when available
// For now, define minimal types needed by the frontend

export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  isActive: boolean;
  channelListCode: string;
}

export interface Channel {
  _id: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  category?: string;
  epgId?: string;
  isActive: boolean;
  channelNumber: number;
}
