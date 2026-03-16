import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if user has admin role
 * Must be used after requireAuth middleware
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - Admin access required',
    });
  }

  next();
};

module.exports = { requireAdmin };
export { requireAdmin };
