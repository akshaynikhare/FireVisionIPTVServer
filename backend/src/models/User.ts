import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { IUserDocument, IUserModel } from '@firevision/shared';

const userSchema = new Schema<IUserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['Admin', 'User'],
      default: 'User',
      index: true,
    },
    channelListCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    channels: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Channel',
      },
    ],
    lastLogin: {
      type: Date,
    },
    metadata: {
      deviceName: String,
      deviceModel: String,
      lastPairedDevice: String,
      pairedAt: Date,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      index: true,
      sparse: true,
    },
    emailVerificationExpires: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      index: true,
      sparse: true,
    },
    passwordResetExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (
  this: IUserDocument,
  candidatePassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to generate unique channel list code.
// Uses crypto for better randomness; the unique index on channelListCode
// guarantees uniqueness even under concurrent requests.
// Callers must handle E11000 duplicate-key errors by retrying.
userSchema.statics.generateChannelListCode = async function (): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(crypto.randomInt(characters.length));
    }

    // Use findOne to avoid obvious collisions (optimistic check),
    // but the unique index is the real safety net.
    const existing = await this.findOne({ channelListCode: code });
    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique channel list code after maximum attempts');
};

// Helper: generate a channelListCode and save the user, retrying on duplicate-key race.
userSchema.statics.generateAndSaveWithCode = async function (
  this: any,
  userData: Record<string, unknown>,
  maxRetries = 3,
): Promise<IUserDocument> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const code = await this.generateChannelListCode();
      const user = new this({ ...userData, channelListCode: code });
      await user.save();
      return user;
    } catch (err: any) {
      const isDuplicateCode = err.code === 11000 && err.keyPattern?.channelListCode;
      if (!isDuplicateCode || attempt === maxRetries - 1) throw err;
      // Retry with a new code
    }
  }
  throw new Error('Failed to save user with unique channel list code');
};

// Method to generate M3U playlist for this user's channel list
userSchema.methods.generateUserPlaylist = async function (
  this: IUserDocument,
  baseUrl?: string,
): Promise<string> {
  const ChannelModel = mongoose.model('Channel');

  let channels;
  if (this.role === 'Admin') {
    channels = await ChannelModel.find({}).sort({ channelGroup: 1, order: 1 });
  } else {
    channels = await ChannelModel.find({
      _id: { $in: this.channels },
    }).sort({ channelGroup: 1, order: 1 });
  }

  let m3uHeader = '#EXTM3U';
  if (baseUrl && this.channelListCode) {
    m3uHeader += ` x-tvg-url="${baseUrl}/api/v1/tv/epg/${this.channelListCode}"`;
  }
  m3uHeader += '\n';

  let m3uContent = m3uHeader;
  m3uContent += `#PLAYLIST:${this.username}'s Channel List\n\n`;

  channels.forEach((channel: any) => {
    m3uContent += channel.toM3U() + '\n\n';
  });

  return m3uContent;
};

// Hide password when converting to JSON
userSchema.methods.toJSON = function (this: IUserDocument) {
  const obj = (this as any).toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model<IUserDocument, Model<IUserDocument> & IUserModel>('User', userSchema);

module.exports = User;
export default User;
