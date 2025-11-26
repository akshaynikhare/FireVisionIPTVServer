const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    default: 'My Playlist'
  },
  playlistCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6,
    index: true
  },
  channels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  }],
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true
});

playlistSchema.statics.generatePlaylistCode = async function () {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let unique = false;
  while (!unique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const existing = await this.findOne({ playlistCode: code });
    if (!existing) unique = true;
  }
  return code;
};

playlistSchema.methods.generateM3U = async function () {
  const Channel = mongoose.model('Channel');
  const channels = await Channel.find({
    _id: { $in: this.channels },
    isActive: true
  }).sort({ channelGroup: 1, order: 1 });
  let m3u = '#EXTM3U\n';
  m3u += `#PLAYLIST:${this.name}\n\n`;
  channels.forEach(c => {
    m3u += c.toM3U() + '\n\n';
  });
  return m3u;
};

module.exports = mongoose.model('Playlist', playlistSchema);
