const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  channelName: {
    type: String,
    required: true,
    trim: true
  },
  channelUrl: {
    type: String,
    required: true
  },
  channelImg: {
    type: String,
    default: ''
  },
  channelGroup: {
    type: String,
    default: 'Uncategorized',
    index: true
  },
  channelDrmKey: {
    type: String,
    default: ''
  },
  channelDrmType: {
    type: String,
    default: ''
  },
  tvgName: {
    type: String,
    default: ''
  },
  tvgLogo: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  },
  metadata: {
    country: String,
    language: String,
    resolution: String,
    tags: [String],
    lastTested: Date,
    isWorking: Boolean,
    responseTime: Number
  }
}, {
  timestamps: true
});

// Index for faster queries
channelSchema.index({ channelGroup: 1, order: 1 });
channelSchema.index({ channelName: 'text' });

// Method to convert to M3U format entry
channelSchema.methods.toM3U = function() {
  let m3uLine = `#EXTINF:-1`;

  if (this.channelId) m3uLine += ` tvg-id="${this.channelId}"`;
  if (this.tvgName || this.channelName) m3uLine += ` tvg-name="${this.tvgName || this.channelName}"`;
  if (this.tvgLogo || this.channelImg) m3uLine += ` tvg-logo="${this.tvgLogo || this.channelImg}"`;
  if (this.channelGroup) m3uLine += ` group-title="${this.channelGroup}"`;

  m3uLine += `,${this.channelName}\n${this.channelUrl}`;

  return m3uLine;
};

// Static method to generate full M3U playlist
channelSchema.statics.generateM3UPlaylist = async function() {
  const channels = await this.find({}).sort({ channelGroup: 1, order: 1 });

  let m3uContent = '#EXTM3U\n\n';

  channels.forEach(channel => {
    m3uContent += channel.toM3U() + '\n\n';
  });

  return m3uContent;
};

const Channel = mongoose.model('Channel', channelSchema);

module.exports = Channel;
