export interface Post {
  id: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'text';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isPublic: boolean;
  allowReposts?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface CreatePostRequest {
  content: string;
  mediaIds?: string[];
  isPublic?: boolean;
  allowReposts?: boolean;
}

export interface UpdatePostRequest {
  content?: string;
  isPublic?: boolean;
  allowReposts?: boolean;
}

export interface PostWithMedia extends Post {
  media: MediaFile[];
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  repostedBy?: {
    id: string;
    username: string;
    profilePicture?: string;
  } | null;
  author?: {
    id: string;
    username: string;
    profilePicture?: string;
  };
}

export interface MediaUploadResult {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface FileStorageConfig {
  type: 'local' | 's3' | 'cloudinary';
  localPath?: string;
  s3Config?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    publicUrl?: string;
  };
  cloudinaryConfig?: {
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
    url?: string;
  };
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface FeedOptions extends PaginationOptions {
  userId?: string;
  includeFollowing?: boolean;
}