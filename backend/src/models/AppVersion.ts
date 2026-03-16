import mongoose, { Schema, Model } from 'mongoose';
import { IAppVersionDocument, IAppVersionModel, UpdateCheckResult } from '@firevision/shared';

const appVersionSchema = new Schema<IAppVersionDocument>(
  {
    versionName: {
      type: String,
      required: true,
      unique: true,
    },
    versionCode: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    apkFileName: {
      type: String,
      required: true,
    },
    apkFileSize: {
      type: Number,
      required: true,
    },
    downloadUrl: {
      type: String,
      required: true,
    },
    releaseNotes: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    minCompatibleVersion: {
      type: Number,
      default: 1,
    },
    releasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying
appVersionSchema.index({ versionCode: -1, isActive: 1 });

// Static method to get latest version
appVersionSchema.statics.getLatestVersion = async function () {
  return await this.findOne({ isActive: true }).sort({ versionCode: -1 }).lean();
};

// Static method to check if update is available
appVersionSchema.statics.checkUpdate = async function (
  currentVersionCode: number,
): Promise<UpdateCheckResult> {
  const latestVersion = await this.findOne({ isActive: true }).sort({ versionCode: -1 }).lean();

  if (!latestVersion) {
    return {
      updateAvailable: false,
      message: 'No version information available',
    };
  }

  if (latestVersion.versionCode > currentVersionCode) {
    return {
      updateAvailable: true,
      isMandatory:
        latestVersion.isMandatory || currentVersionCode < latestVersion.minCompatibleVersion,
      latestVersion: latestVersion,
    };
  }

  return {
    updateAvailable: false,
    message: 'You are using the latest version',
    currentVersion: latestVersion,
  };
};

const AppVersion = mongoose.model<
  IAppVersionDocument,
  Model<IAppVersionDocument> & IAppVersionModel
>('AppVersion', appVersionSchema);

module.exports = AppVersion;
export default AppVersion;
