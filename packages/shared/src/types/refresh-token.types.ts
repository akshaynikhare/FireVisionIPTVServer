import { Types, Document } from 'mongoose';

export interface IRefreshToken {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefreshTokenDocument extends IRefreshToken, Document {
  _id: Types.ObjectId;
  isActive(): boolean;
}
