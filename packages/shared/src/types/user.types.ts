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
  };
  googleId?: string;
  githubId?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
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
