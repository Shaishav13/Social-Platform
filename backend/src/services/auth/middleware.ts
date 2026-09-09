import { Request, Response, NextFunction } from 'express';
import { UserModel } from './models';
import { JWTPayload } from './types';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  const decoded = UserModel.verifyAccessToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token',
    });
  }

  try {
    const user = await UserModel.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists',
      });
    }

    if (user.isRestricted) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been restricted by platform administration',
      });
    }

    if (user.isVerified === false) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message: 'Please verify your email address before accessing this resource',
      });
    }

    // Synchronize role in payload in case admin changed it
    if (user.role) {
      decoded.role = user.role;
    }
  } catch (err) {
    console.warn('[AUTH] Real-time user status check warning:', err);
  }

  req.user = decoded;
  next();
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = UserModel.verifyAccessToken(token);
    if (decoded) {
      try {
        const user = await UserModel.findUserById(decoded.userId);
        if (user && !user.isRestricted) {
          if (user.role) decoded.role = user.role;
          req.user = decoded;
        }
      } catch {
        req.user = decoded;
      }
    }
  }

  next();
};