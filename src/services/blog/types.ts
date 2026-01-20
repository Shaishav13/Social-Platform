export interface Blog {
  id: string;
  authorId: string;
  title: string;
  content: string; // Rich text/HTML content
  excerpt: string;
  tags: string[];
  isDraft: boolean;
  publishedAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogRequest {
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  isDraft?: boolean;
}

export interface UpdateBlogRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  isDraft?: boolean;
}

export interface BlogListOptions {
  page: number;
  limit: number;
  authorId?: string;
  tags?: string[];
  search?: string;
  draftsOnly?: boolean;
  publishedOnly?: boolean;
}

export interface BlogSearchResult {
  blogs: Blog[];
  totalCount: number;
  hasMore: boolean;
}

export interface BlogValidationResult {
  isValid: boolean;
  errors: string[];
}