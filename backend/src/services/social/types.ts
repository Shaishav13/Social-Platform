export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string; // For nested comments
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Like {
  id: string;
  userId: string;
  targetId: string; // Post or Comment ID
  targetType: 'post' | 'comment';
  createdAt: Date;
}

export interface Share {
  id: string;
  userId: string;
  postId: string;
  createdAt: Date;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface FollowRequest {
  id: string;
  requesterId: string; // User who sent the request
  targetId: string; // User who received the request
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response types
export interface CreateCommentRequest {
  content: string;
  parentId?: string;
}

export interface CommentWithReplies extends Comment {
  replies: CommentWithReplies[];
  author: {
    id: string;
    username: string;
    profilePicture?: string;
  };
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface ShareResponse {
  shared: boolean;
  shareCount: number;
}

export interface FollowResponse {
  following: boolean;
  requested?: boolean; // For follow requests
  followerCount: number;
}