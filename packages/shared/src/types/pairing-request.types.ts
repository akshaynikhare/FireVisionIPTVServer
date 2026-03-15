import { Types, Document } from 'mongoose';

export type PairingStatus = 'pending' | 'completed' | 'expired';

export interface IPairingRequest {
  pin: string;
  deviceName: string;
  deviceModel: string;
  status: PairingStatus;
  userId: Types.ObjectId | null;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPairingRequestDocument extends IPairingRequest, Document {
  _id: Types.ObjectId;
  isExpired(): boolean;
  markExpired(): Promise<void>;
}

export interface IPairingRequestModel {
  generatePin(): Promise<string>;
}
