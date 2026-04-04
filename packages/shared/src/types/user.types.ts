import { Types, Document } from 'mongoose';

export type UserRole = 'Admin' | 'User';

export interface IUser {
  username: string;
  password: string;
  email: string;
  role: UserRole;
  channelListCode: string;
  isActive: boolean;
  profilePicture: string | null;
  channels: Types.ObjectId[];
  lastLogin?: Date;
  metadata?: {
    deviceName?: string;
    deviceModel?: string;
    lastPairedDevice?: string;
    pairedAt?: Date;
    favorites?: string[];
    favoritesLastModified?: number;
    favoritesDeviceId?: string;
  };
  googleId?: string;
  githubId?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  codeRevokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateUserPlaylist(): Promise<string>;
}

export interface IUserModel {
  generateChannelListCode(): Promise<string>;
}
