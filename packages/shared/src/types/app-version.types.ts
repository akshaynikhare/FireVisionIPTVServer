import { Types, Document } from 'mongoose';

export interface IAppVersion {
  versionName: string;
  versionCode: number;
  apkFileName: string;
  apkFileSize: number;
  downloadUrl: string;
  releaseNotes: string;
  isActive: boolean;
  isMandatory: boolean;
  minCompatibleVersion: number;
  releasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAppVersionDocument extends IAppVersion, Document {
  _id: Types.ObjectId;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  isMandatory?: boolean;
  latestVersion?: IAppVersion;
  message?: string;
  currentVersion?: IAppVersion;
}

export interface IAppVersionModel {
  getLatestVersion(): Promise<IAppVersion | null>;
  checkUpdate(currentVersionCode: number): Promise<UpdateCheckResult>;
}
