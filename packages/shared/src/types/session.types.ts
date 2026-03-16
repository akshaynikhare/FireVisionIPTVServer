import { Types, Document } from 'mongoose';
import { UserRole } from './user.types';

export interface ISession {
  sessionId: string;
  userId: Types.ObjectId;
  username: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionDocument extends ISession, Document {
  _id: Types.ObjectId;
  updateActivity(): Promise<ISessionDocument>;
  isValid(): boolean;
}
