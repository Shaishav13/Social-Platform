export interface SearchQuery {
  query: string;
  contentType?: 'posts' | 'blogs' | 'all';
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'date';
}

export interface SearchResult {
  type: 'post' | 'blog';
  id: string;
  authorId: string;
  title: string;
  content: string;
  excerpt: string;
  relevanceScore: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  
  // Post-specific fields
  mediaType?: 'image' | 'video' | 'text';
  mediaUrls?: string[];
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isPublic?: boolean;
  
  // Blog-specific fields
  tags?: string[];
  isDraft?: boolean;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
  contentType: string;
  searchTime: number; // in milliseconds
}

export interface TrendingContent {
  type: 'post' | 'blog';
  id: string;
  title: string;
  excerpt: string;
  engagementScore: number;
  createdAt: Date;
}

export interface FeedOptions {
  userId?: string;
  page: number;
  limit: number;
  sortBy?: 'chronological' | 'algorithmic';
  contentType?: 'posts' | 'blogs' | 'all';
  followingOnly?: boolean;
}

export interface EnhancedFeedResult {
  content: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
  feedType: string;
  trending?: TrendingContent[];
}