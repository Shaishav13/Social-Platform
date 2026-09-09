// User types
export interface User {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  isPrivate: boolean;
  role?: 'admin' | 'moderator' | 'user';
  isRestricted?: boolean;
  isVerified?: boolean;
  emailVerifiedAt?: string | null;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isFollowing?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Admin Management types
export interface AdminStats {
  users: {
    total: number;
    active: number;
    restricted: number;
    admins: number;
  };
  content: {
    posts: number;
    comments: number;
  };
  moderation: {
    totalReports: number;
    pendingReports: number;
  };
  system: {
    uptimeSeconds: number;
    nodeVersion: string;
    memoryUsageMb: number;
  };
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  isPrivate: boolean;
  role: 'admin' | 'moderator' | 'user';
  isRestricted: boolean;
  postCount?: number;
  followerCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeatures {
  publicRegistration: boolean;
  mediaUploads: boolean;
  commenting: boolean;
  followRequests: boolean;
  maintenanceMode: boolean;
  trendingFeed: boolean;
}

export interface PlatformSettings {
  siteName: string;
  announcementBanner: string;
  defaultDensity: 'comfortable' | 'compact';
  maxPostLength: number;
  rateLimitMaxRequests: number;
}

export interface ModerationReport {
  id: string;
  reporter_id: string;
  target_id: string;
  target_type: 'post' | 'comment';
  reason: string;
  status: 'pending' | 'resolved';
  created_at: string;
  reporter_username?: string;
  target_content?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface VerifyEmailCredentials {
  email: string;
  otp: string;
}

export interface RegisterResult {
  requiresVerification: boolean;
  email: string;
  username?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

// Post types
export interface Post {
  id: string;
  authorId: string;
  author?: User;
  content: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'text';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isPublic: boolean;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  content: string;
  parentId?: string;
  likeCount: number;
  isLiked?: boolean;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

// Blog types
export interface Blog {
  id: string;
  authorId: string;
  author?: User;
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  isDraft: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'share' | 'mention';
  actorId: string;
  actor?: User;
  targetId: string;
  postId?: string;
  metadata?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Follow Request types
export interface FollowRequest {
  id: string;
  requesterId: string;
  requester?: User;
  targetId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}