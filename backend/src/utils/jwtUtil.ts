import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken';
import { Request } from 'express';
import { IUserDocument } from '@firevision/shared';

function getRequiredEnv(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value) return value;
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  console.warn(`WARNING: ${key} not set, using insecure dev fallback. Do NOT use in production.`);
  return devFallback;
}

const ACCESS_SECRET = getRequiredEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
const REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_MS = parseInt(process.env.JWT_REFRESH_TTL_MS || String(30 * 24 * 60 * 60 * 1000));

function signAccessToken(user: IUserDocument): string {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      playlistCode: (user as any).playlistCode,
    },
    ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TTL as any },
  );
}

function signRefreshToken(user: IUserDocument): string {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ sub: user._id.toString(), jti }, REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: Math.floor(REFRESH_TTL_MS / 1000) as any,
  });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function persistRefreshToken(token: string, user: IUserDocument, req: Request) {
  const decoded = jwt.decode(token) as jwt.JwtPayload;
  const tokenHash = hashToken(token);
  const expiresAt = new Date(decoded.exp! * 1000);
  const doc = new RefreshToken({
    userId: user._id,
    tokenHash,
    expiresAt,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  await doc.save();
  return doc;
}

module.exports = { signAccessToken, signRefreshToken, persistRefreshToken, hashToken };
export { signAccessToken, signRefreshToken, persistRefreshToken, hashToken };
