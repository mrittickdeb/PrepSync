import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { User, type IUser } from '../models';
import { ApiError } from './error';

// Extend Express request type
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or invalid authorization header', 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Missing access token', 'NO_TOKEN');
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw ApiError.unauthorized('User not found', 'USER_NOT_FOUND');
    }

    if (!user.emailVerified) {
      throw ApiError.forbidden('Email not verified', 'EMAIL_NOT_VERIFIED');
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    // JWT verification errors
    const err = error as Error;
    if (err.name === 'TokenExpiredError') {
      next(ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED'));
    } else if (err.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized('Invalid access token', 'INVALID_TOKEN'));
    } else {
      next(ApiError.unauthorized('Authentication failed', 'AUTH_FAILED'));
    }
  }
}

/** Optional auth — attaches user if token present, but doesn't require it */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      next();
      return;
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (user) {
      req.user = user;
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }
  next();
}
