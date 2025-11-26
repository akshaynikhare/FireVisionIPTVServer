#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/firevision-iptv';
async function run() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  } catch (connErr) {
    console.error('\n[Migration] Failed to connect to MongoDB at', MONGODB_URI);
    console.error('[Migration] Ensure MongoDB is running or set MONGODB_URI env variable.');
    console.error(connErr);
    process.exit(2);
  }
  const User = require('../src/models/User');
  const Playlist = require('../src/models/Playlist');
  const Channel = require('../src/models/Channel');

  const users = await User.find({});
  let created = 0;
  for (const user of users) {
    const existing = await Playlist.findOne({ userId: user._id });
    if (existing) continue;
    const playlist = new Playlist({
      userId: user._id,
      name: `${user.username}'s Playlist`,
      playlistCode: user.playlistCode || await Playlist.generatePlaylistCode(),
      channels: user.channels || [],
      isPublic: false
    });
    await playlist.save();
    created++;
  }
  console.log(`Migration complete. Created ${created} playlists.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
