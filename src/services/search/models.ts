import { SearchQuery, SearchResponse, FeedOptions, EnhancedFeedResult } from './types';
import { SearchDatabase } from './database';

export class SearchModel {
  static async searchUsers(query: string, page: number = 1, limit: number = 20): Promise<{ results: any[]; totalCount: number }> {
    // Validate search query
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    if (query.length > 500) {
      throw new Error('Search query cannot exceed 500 characters');
    }

    // Set defaults and validate pagination
    const searchPage = Math.max(1, page);
    const searchLimit = Math.min(50, Math.max(1, limit));

    const { results, totalCount } = await SearchDatabase.searchUsers(query.trim(), searchPage, searchLimit);
    
    return { results, totalCount };
  }

  static async search(searchQuery: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Validate search query
    if (!searchQuery.query || searchQuery.query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    if (searchQuery.query.length > 500) {
      throw new Error('Search query cannot exceed 500 characters');
    }

    // Set defaults
    const query: SearchQuery = {
      query: searchQuery.query.trim(),
      contentType: searchQuery.contentType || 'all',
      tags: searchQuery.tags,
      page: Math.max(1, searchQuery.page || 1),
      limit: Math.min(50, Math.max(1, searchQuery.limit || 20)),
      sortBy: searchQuery.sortBy || 'relevance'
    };

    const { results, totalCount } = await SearchDatabase.searchContent(query);
    
    const searchTime = Date.now() - startTime;
    const hasMore = (query.page * query.limit) < totalCount;

    return {
      query: query.query,
      results,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        hasMore
      },
      contentType: query.contentType,
      searchTime
    };
  }

  static async getEnhancedFeed(options: FeedOptions): Promise<EnhancedFeedResult> {
    // Validate options
    const feedOptions: FeedOptions = {
      userId: options.userId,
      page: Math.max(1, options.page || 1),
      limit: Math.min(50, Math.max(1, options.limit || 20)),
      sortBy: options.sortBy || 'chronological',
      contentType: options.contentType || 'all',
      followingOnly: options.followingOnly || false
    };

    const { content, totalCount, trending } = await SearchDatabase.getEnhancedFeed(feedOptions);
    
    const hasMore = (feedOptions.page * feedOptions.limit) < totalCount;

    return {
      content,
      pagination: {
        page: feedOptions.page,
        limit: feedOptions.limit,
        hasMore
      },
      feedType: `${feedOptions.sortBy}-${feedOptions.contentType}${feedOptions.followingOnly ? '-following' : ''}`,
      trending
    };
  }

  static validateSearchQuery(query: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!query || query.trim().length === 0) {
      errors.push('Search query cannot be empty');
    }

    if (query.length > 500) {
      errors.push('Search query cannot exceed 500 characters');
    }

    // Check for potentially harmful patterns
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(query)) {
        errors.push('Search query contains potentially harmful code');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitizeSearchQuery(query: string): string {
    return query
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  static parseSearchTags(tagsParam: string | undefined): string[] | undefined {
    if (!tagsParam || tagsParam.trim().length === 0) return undefined;
    
    const tags = tagsParam
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0 && tag.length <= 50)
      .slice(0, 10); // Limit to 10 tags
    
    return tags.length > 0 ? tags : undefined;
  }

  static async refreshTrendingContent(): Promise<void> {
    await SearchDatabase.refreshTrendingContent();
  }
}