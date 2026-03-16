import { Types, Document } from 'mongoose';

export interface IEpgProgram {
  channelEpgId: string;
  title: string;
  description: string | null;
  category: string[];
  startTime: Date;
  endTime: Date;
  icon: string | null;
  language: string | null;
}

export interface IEpgProgramDocument extends IEpgProgram, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
