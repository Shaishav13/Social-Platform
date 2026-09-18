export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  profilePicture?: string | undefined;
  bio?: string | undefined;
  isPrivate: boolean;
  is18Plus?: boolean;
  role?: 'admin' | 'moderator' | 'user';
  isRestricted?: boolean;
  isVerified?: boolean;
  emailVerifiedAt?: Date | null;
  dateOfBirth?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  dateOfBirth?: string | undefined; // optional for backward compatibility, but required in new flow
  bio?: string | undefined;
}

export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

export interface ResendOtpRequest {
  email: string;
}

export interface EmailVerificationRecord {
  id: string;
  userId: string;
  email: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  lastSentAt: Date;
  createdAt: Date;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role?: 'admin' | 'moderator' | 'user';
  isVerified?: boolean;
  iat?: number;
  exp?: number;
}