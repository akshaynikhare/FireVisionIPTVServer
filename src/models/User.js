const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  role: {
    type: String,
    enum: ['Admin', 'User'],
    default: 'User',
    index: true
  },
  playlistCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // User-specific channels (only for 'User' role, Admin has access to all)
  channels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  }],
  // Statistics
  lastLogin: {
    type: Date
  },
  metadata: {
    deviceName: String,
    deviceModel: String,
    lastPairedDevice: String,
    pairedAt: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to generate unique playlist code
userSchema.statics.generatePlaylistCode = async function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existing = await this.findOne({ playlistCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

// Method to generate M3U playlist for this user
userSchema.methods.generateUserPlaylist = async function() {
  const Channel = mongoose.model('Channel');

  let channels;
  if (this.role === 'Admin') {
    // Admin gets all active channels
    channels = await Channel.find({ isActive: true }).sort({ channelGroup: 1, order: 1 });
  } else {
    // Regular users get only their assigned channels
    channels = await Channel.find({
      _id: { $in: this.channels },
      isActive: true
    }).sort({ channelGroup: 1, order: 1 });
  }

  let m3uContent = '#EXTM3U\n';
  m3uContent += `#PLAYLIST:${this.username}'s Playlist\n\n`;

  channels.forEach(channel => {
    m3uContent += channel.toM3U() + '\n\n';
  });

  return m3uContent;
};

// Hide password when converting to JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
