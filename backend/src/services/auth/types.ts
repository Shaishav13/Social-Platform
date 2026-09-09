export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  profilePicture?: string | undefined;
  bio?: string | undefined;
  isPrivate: boolean;
  role?: 'admin' | 'moderator' | 'user';
  isRestricted?: boolean;
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
  bio?: string | undefined;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role?: 'admin' | 'moderator' | 'user';
  iat?: number;
  exp?: number;
}