import { Request, Response, NextFunction } from 'express';
import Session from '../models/Session';
import User from '../models/User';

/**
 * Middleware that authenticates via session OR TV channel list code.
 * Used on endpoints the TV app needs (e.g. GET /channels).
 *
 * Auth order:
 * 1. X-TV-Code header → look up user by channelListCode
 * 2. X-Session-ID header → standard session auth
 */
const requireTvOrSessionAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Try TV code auth first
    const tvCode = req.headers['x-tv-code'] as string | undefined;
    if (tvCode) {
      const user = (await User.findOne({
        channelListCode: tvCode.toUpperCase(),
        isActive: true,
      })) as any;

      if (user) {
        req.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          channelListCode: user.channelListCode,
          isActive: user.isActive,
          emailVerified: user.emailVerified ?? false,
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid TV code',
      });
    }

    // 2. Fall back to session auth
    const sessionId = req.headers['x-session-id'] as string | undefined;
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'No authentication provided',
      });
    }

    const session = await Session.findOne({ sessionId }).populate('userId');

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session',
      });
    }

    if (!session.isValid()) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'Session expired',
      });
    }

    if (!session.userId || !(session.userId as any).isActive) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
      });
    }

    await session.updateActivity();

    const user = session.userId as any;
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      channelListCode: user.channelListCode,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('TV/Session auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

export { requireTvOrSessionAuth };
