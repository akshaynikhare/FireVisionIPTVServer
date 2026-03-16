import { Request, Response, NextFunction } from 'express';
import Session from '../models/Session';

/**
 * Middleware to check if user is authenticated
 * Validates session from database and attaches user info to request
 */
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.headers['x-session-id'] as string | undefined;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'No session ID provided',
      });
    }

    // Find session in database
    const session = await Session.findOne({ sessionId }).populate('userId');

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session',
      });
    }

    // Check if session is expired
    if (!session.isValid()) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'Session expired',
      });
    }

    // Check if user still exists and is active
    if (!session.userId || !(session.userId as any).isActive) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
      });
    }

    // Update last activity
    await session.updateActivity();

    // Attach user info to request
    const user = session.userId as any;
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      playlistCode: user.playlistCode,
      isActive: user.isActive,
    };

    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

module.exports = { requireAuth };
export { requireAuth };
