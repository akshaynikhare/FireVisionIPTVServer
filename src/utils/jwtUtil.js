const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_MS = parseInt(process.env.JWT_REFRESH_TTL_MS || (30 * 24 * 60 * 60 * 1000));

function signAccessToken(user) {
  return jwt.sign({
    sub: user._id.toString(),
    role: user.role,
    playlistCode: user.playlistCode
  }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefreshToken(user) {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ sub: user._id.toString(), jti }, REFRESH_SECRET, { expiresIn: Math.floor(REFRESH_TTL_MS / 1000) });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function persistRefreshToken(token, user, req) {
  const decoded = jwt.decode(token);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(decoded.exp * 1000);
  const doc = new RefreshToken({
    userId: user._id,
    tokenHash,
    expiresAt,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip
  });
  await doc.save();
  return doc;
}

module.exports = { signAccessToken, signRefreshToken, persistRefreshToken, hashToken };
