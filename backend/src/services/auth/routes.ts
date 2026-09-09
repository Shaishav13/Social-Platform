import { Router, Request, Response } from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import { UserModel, DataExportModel } from './models';
import { RegisterRequest, LoginRequest } from './types';
import { authenticateToken } from './middleware';
import { AuthDatabase } from './database';
import { DatabaseConnection } from '../../config/database';
import { EmailService } from './emailService';
import { createRateLimiter } from '../../middleware/security';

const router = Router();

// Dedicated rate limiters for auth endpoints
const registerLimiter = createRateLimiter(15 * 60 * 1000, 15, 'Too many registration requests from this IP. Please try again later.');
const loginLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Too many login attempts from this IP. Please try again later.');
const verifyOtpLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Too many verification attempts from this IP. Please try again later.');
const resendOtpLimiter = createRateLimiter(15 * 60 * 1000, 10, 'Too many OTP resend requests from this IP. Please try again later.');

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be no more than 50 characters long',
    }),
  email: Joi.string()
    .email()
    .max(255)
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.max': 'Email must be no more than 255 characters long',
    }),
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must be no more than 100 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  bio: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Bio must be no more than 500 characters long',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

const verifyEmailSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Verification code must be exactly 6 digits',
      'any.required': 'Verification code is required',
    }),
});

const resendOtpSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),
});

// Sanitization helper
function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

// GET /auth/smtp-status (safe diagnostic endpoint)
router.get('/smtp-status', (_req: Request, res: Response) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  res.json({
    configured: !!(host && user && pass),
    host: host || 'not configured',
    port: process.env.SMTP_PORT || '587',
    userConfigured: !!user,
    userMasked: user ? `${user.substring(0, 3)}***@${user.split('@')[1] || ''}` : 'none',
    passwordConfigured: !!pass,
  });
});

// POST /auth/register
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message),
      });
    }

    const registerData: RegisterRequest = {
      username: sanitizeInput(value.username),
      email: sanitizeInput(value.email.toLowerCase()),
      password: value.password, // Don't sanitize password
      bio: value.bio ? sanitizeInput(value.bio) : undefined,
    };

    // Check if user with this email already exists
    const existingUser = await AuthDatabase.findUserByEmail(registerData.email);
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // User exists but has not verified email yet. Allow resending OTP and updating credentials
      const existingByUsername = await AuthDatabase.findUserByUsername(registerData.username);
      if (existingByUsername && existingByUsername.id !== existingUser.id) {
        return res.status(409).json({
          success: false,
          message: 'User with this username already exists',
        });
      }

      // Update unverified user's credentials
      const newPasswordHash = await UserModel.hashPassword(registerData.password);
      await DatabaseConnection.query(
        'UPDATE users SET username = $1, password_hash = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [registerData.username, newPasswordHash, registerData.bio || null, existingUser.id]
      );

      // Generate 6-digit OTP
      const otp = UserModel.generateOTP();
      const otpHash = UserModel.hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await AuthDatabase.createOrUpdateEmailVerification(existingUser.id, existingUser.email, otpHash, expiresAt);
      await EmailService.sendVerificationOtp(existingUser.email, registerData.username, otp);

      return res.status(200).json({
        success: true,
        message: 'Account registration updated. A 6-digit verification code has been dispatched to your email.',
        requiresVerification: true,
        data: {
          email: existingUser.email,
          username: registerData.username,
        },
      });
    }

    // Check if username is already taken
    const existingUserByUsername = await AuthDatabase.findUserByUsername(registerData.username);
    if (existingUserByUsername) {
      return res.status(409).json({
        success: false,
        message: 'User with this username already exists',
      });
    }

    // Create user (unverified by default)
    const user = await UserModel.createUser(registerData);

    // Generate 6-digit OTP
    const otp = UserModel.generateOTP();
    const otpHash = UserModel.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await AuthDatabase.createOrUpdateEmailVerification(user.id, user.email, otpHash, expiresAt);
    await EmailService.sendVerificationOtp(user.email, user.username, otp);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. A 6-digit verification code has been dispatched to your email. (Please check your Spam/Junk folder if not in Inbox).',
      requiresVerification: true,
      data: {
        email: user.email,
        username: user.username,
      },
    });

  } catch (error: any) {
    console.error('Registration error:', error);

    // Handle specific errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('validation failed')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle database constraint errors
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      let message = 'User already exists';
      if (error.constraint?.includes('email')) {
        message = 'User with this email already exists';
      } else if (error.constraint?.includes('username')) {
        message = 'User with this username already exists';
      }
      
      return res.status(409).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/verify-email
router.post('/verify-email', verifyOtpLimiter, async (req: Request, res: Response) => {
  try {
    const { error, value } = verifyEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const email = sanitizeInput(value.email.toLowerCase());
    const otp = value.otp.trim();

    // Look up user
    const user = await AuthDatabase.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification request',
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Email is already verified. You can log in directly.',
      });
    }

    // Look up active verification record
    const verifRecord = await AuthDatabase.findActiveEmailVerification(email);
    if (!verifRecord) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired or is invalid. Please request a new code.',
      });
    }

    // Check maximum attempts
    if (verifRecord.attempts >= verifRecord.maxAttempts) {
      await AuthDatabase.deleteEmailVerification(verifRecord.id);
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    // Constant-time timing-safe OTP verification
    const isMatch = UserModel.verifyOtpHash(otp, verifRecord.otpHash);
    if (!isMatch) {
      const attempts = await AuthDatabase.incrementVerificationAttempts(verifRecord.id);
      const remaining = Math.max(0, verifRecord.maxAttempts - attempts);

      if (remaining <= 0) {
        await AuthDatabase.deleteEmailVerification(verifRecord.id);
        return res.status(400).json({
          success: false,
          message: 'Maximum attempts exceeded. This code is now invalid. Please request a new code.',
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    // OTP matched! Invalidate verification record and mark user verified
    await AuthDatabase.deleteEmailVerification(verifRecord.id);
    await AuthDatabase.markUserVerified(user.id);

    // Update in-memory user instance
    user.isVerified = true;
    user.emailVerifiedAt = new Date();

    // Generate access & refresh tokens
    const tokens = await UserModel.generateTokens(user);

    const { passwordHash, ...userResponse } = user;
    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to UdtaBirdie.',
      data: {
        user: userResponse,
        tokens,
      },
    });

  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/resend-verification-otp
router.post('/resend-verification-otp', resendOtpLimiter, async (req: Request, res: Response) => {
  try {
    const { error, value } = resendOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const email = sanitizeInput(value.email.toLowerCase());

    const user = await AuthDatabase.findUserByEmail(email);

    // If user doesn't exist, return safe response to avoid email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an unverified account with that email exists, a verification code has been dispatched.',
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'This email is already verified. You can log in directly.',
      });
    }

    // Check cooldown from last sent time
    const existingRecord = await AuthDatabase.findActiveEmailVerification(email);
    if (existingRecord) {
      const elapsedSeconds = (Date.now() - existingRecord.lastSentAt.getTime()) / 1000;
      if (elapsedSeconds < 60) {
        const retryAfter = Math.ceil(60 - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfter} seconds before requesting another code.`,
          retryAfter,
        });
      }
    }

    // Generate fresh OTP
    const otp = UserModel.generateOTP();
    const otpHash = UserModel.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await AuthDatabase.createOrUpdateEmailVerification(user.id, user.email, otpHash, expiresAt);
    await EmailService.sendVerificationOtp(user.email, user.username, otp);

    res.status(200).json({
      success: true,
      message: 'A new verification code has been dispatched to your email address. (Please check your Spam/Junk folder if not in Inbox).',
    });

  } catch (error: any) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message),
      });
    }

    const loginData: LoginRequest = {
      email: sanitizeInput(value.email.toLowerCase()),
      password: value.password,
    };

    // Authenticate user credentials
    const user = await UserModel.authenticateUser(loginData.email, loginData.password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if email has been verified
    if (user.isVerified === false) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true,
        email: user.email,
        message: 'Your email address is not verified. Please verify your email before logging in.',
      });
    }

    // Generate tokens
    const tokens = await UserModel.generateTokens(user);

    // Return success response (exclude password hash)
    const { passwordHash, ...userResponse } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        tokens,
      },
    });

  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.message?.includes('restricted')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    const tokens = await UserModel.refreshTokens(refreshToken);

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        tokens,
      },
    });

  } catch (error: any) {
    console.error('Token refresh error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    await UserModel.logout(refreshToken);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error: any) {
    console.error('Logout error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/logout-all
router.post('/logout-all', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

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

    await UserModel.logoutAllSessions(decoded.userId);

    res.json({
      success: true,
      message: 'Logged out from all sessions successfully',
    });

  } catch (error: any) {
    console.error('Logout all error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /auth/me - Get current user info
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const user = await UserModel.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return user data (exclude password hash)
    const { passwordHash, ...userResponse } = user;
    
    res.json({
      success: true,
      message: 'User data retrieved successfully',
      data: userResponse,
    });

  } catch (error: any) {
    console.error('Get user error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /auth/export - Export user data
router.get('/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Generate comprehensive data export
    const exportData = await DataExportModel.exportUserData(userId);

    res.json({
      success: true,
      message: 'User data exported successfully',
      data: exportData,
    });

  } catch (error: any) {
    console.error('Data export error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// DELETE /auth/account - Delete user account
router.delete('/account', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { password } = req.body;

    console.log('Account deletion request:', { userId, hasPassword: !!password });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation required',
      });
    }

    // Verify password before deletion
    const user = await UserModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('User found for deletion:', user.username);

    const isPasswordValid = await UserModel.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    console.log('Password verified, proceeding with deletion');

    // Perform account deletion with cascade delete
    try {
      // Delete user - foreign key constraints will handle cascading deletes
      const result = await DatabaseConnection.query('DELETE FROM users WHERE id = $1', [userId]);
      console.log('Deletion result:', result.rowCount);

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });

    } catch (deletionError: any) {
      console.error('Account deletion error:', deletionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete account: ' + deletionError.message,
      });
    }

  } catch (error: any) {
    console.error('Account deletion error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message,
    });
  }
});

// PUT /auth/profile - Update user profile
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { username, bio, isPrivate } = req.body;

    // Validate input
    if (username && (username.length < 3 || username.length > 50)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 50 characters',
      });
    }

    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be no more than 500 characters',
      });
    }

    // Check if username is already taken (if username is being changed)
    if (username) {
      const existingUser = await AuthDatabase.findUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    // Update user profile
    const updateData: any = {};
    if (username) updateData.username = username.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (isPrivate !== undefined) updateData.isPrivate = Boolean(isPrivate);

    const updatedUser = await AuthDatabase.updateUser(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return updated user data (exclude password hash)
    const { passwordHash, ...userResponse } = updatedUser;
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userResponse,
    });

  } catch (error: any) {
    console.error('Profile update error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /auth/password - Change password
router.put('/password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    // Validate new password
    const passwordValidation = UserModel.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password validation failed',
        errors: passwordValidation.errors,
      });
    }

    // Get current user
    const user = await UserModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await UserModel.verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const newPasswordHash = await UserModel.hashPassword(newPassword);

    // Update password in database
    await DatabaseConnection.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Invalidate all sessions to force re-login
    await AuthDatabase.invalidateAllUserSessions(userId);

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });

  } catch (error: any) {
    console.error('Password change error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/forgot-password
// Generates a reset token and returns a reset link (no email needed for self-hosted setup)
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await AuthDatabase.findUserByEmail(email.trim().toLowerCase());

    // Always respond success to prevent email enumeration attacks
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a reset token has been generated.',
      });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    await AuthDatabase.createPasswordResetToken(user.id, token);

    // Dispatch password reset email via EmailService
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;
    await EmailService.sendPasswordResetEmail(user.email, resetUrl);

    // Always return safe generic confirmation without leaking the token
    res.json({
      success: true,
      message: 'If an account with that email exists, password reset instructions have been dispatched.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    // Validate new password strength
    const passwordValidation = UserModel.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
      });
    }

    // Look up token
    const resetRecord = await AuthDatabase.findPasswordResetToken(token);
    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (resetRecord.used) {
      return res.status(400).json({ success: false, message: 'This reset token has already been used' });
    }

    // Hash new password and update
    const newPasswordHash = await UserModel.hashPassword(newPassword);
    await AuthDatabase.updateUserPassword(resetRecord.userId, newPasswordHash);
    await AuthDatabase.markPasswordResetTokenUsed(token);

    // Invalidate all active sessions for security
    await AuthDatabase.invalidateAllUserSessions(resetRecord.userId);

    res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;