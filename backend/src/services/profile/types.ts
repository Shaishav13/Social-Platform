export interface ProfileSettings {
  isPrivate: boolean;
  showEmail: boolean;
  showFollowers: boolean;
  allowDirectMessages: boolean;
}

export interface ProfileUpdateRequest {
  username?: string | undefined;
  bio?: string | undefined;
  profilePicture?: string | undefined;
  settings?: Partial<ProfileSettings> | undefined;
}

export interface PublicProfile {
  id: string;
  username: string;
  bio?: string | undefined;
  profilePicture?: string | undefined;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isPrivate: boolean;
  isFollowing?: boolean | undefined; // Only present when viewed by another user
  createdAt: Date;
}

export interface PrivateProfile extends PublicProfile {
  email?: string | undefined; // Only shown if showEmail is true and user has permission
  settings: ProfileSettings;
}

export interface ProfilePictureUploadRequest {
  file: Express.Multer.File;
}

export interface ProfilePictureUploadResult {
  url: string;
  filename: string;
}