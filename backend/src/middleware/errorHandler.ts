import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Centralized error handling middleware
 */
function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;

  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.path} - Error ${status}: ${err.message}`,
  );
  if (status === 500) {
    console.error(err.stack);
  }

  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal Server Error' : err.message,
      status,
    },
  });
}

module.exports = { errorHandler };
export { errorHandler };
