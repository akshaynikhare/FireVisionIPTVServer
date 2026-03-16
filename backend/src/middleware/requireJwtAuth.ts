import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Middleware to protect routes with Bearer token (JWT)
 */
function requireJwtAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing bearer token' });
  }
  try {
    const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
    if (!ACCESS_SECRET) {
      console.error('JWT_ACCESS_SECRET not configured');
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    const payload = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;
    req.jwt = payload as any;
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

module.exports = { requireJwtAuth };
export { requireJwtAuth };
