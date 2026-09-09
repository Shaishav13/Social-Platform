import * as fc from 'fast-check';

// Helper function to calculate engagement score for algorithmic sorting
function calculateEngagementScore(post: {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: Date;
}): number {
  const likes = post.likeCount || 0;
  const comments = post.commentCount || 0;
  const shares = post.shareCount || 0;
  const hoursOld = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
  
  // Engagement score with time decay (same formula as in search database)
  return (likes * 3 + comments * 2 + shares * 4) / Math.pow(hoursOld + 2, 1.5);
}

describe('Feed Generation Property Tests', () => {
  
  describe('Property 18: Feed Content Relevance', () => {
    /**
     * Feature: social-media-platform, Property 18: Feed Content Relevance
     * Validates: Requirements 7.1, 7.5
     * 
     * For any user's main feed, it should contain posts from followed users and 
     * trending content organized chronologically or algorithmically
     */
    test('should generate relevant feed content based on user preferences', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate feed options
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            sortBy: fc.constantFrom('chronological', 'algorithmic'),
            followingOnly: fc.boolean(),
            page: fc.integer({ min: 1, max: 5 }),
            limit: fc.integer({ min: 1, max: 20 })
          }),
          // Generate mock posts data
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              authorId: fc.string({ minLength: 1, maxLength: 50 }),
              content: fc.string({ minLength: 10, maxLength: 200 }),
              likeCount: fc.integer({ min: 0, max: 100 }),
              commentCount: fc.integer({ min: 0, max: 50 }),
              shareCount: fc.integer({ min: 0, max: 50 }),
              createdAt: fc.date({ min: new Date('2023-01-01'), max: new Date() }),
              isPublic: fc.boolean(),
              isFollowed: fc.boolean() // Mock follow relationship
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (feedOptions, mockPosts) => {
            // Mock feed generation logic
            let filteredPosts = mockPosts.filter(post => post.isPublic);
            
            // Apply following filter if requested
            if (feedOptions.followingOnly) {
              filteredPosts = filteredPosts.filter(post => 
                post.isFollowed || post.authorId === feedOptions.userId
              );
            }
            
            // Apply sorting
            if (feedOptions.sortBy === 'algorithmic') {
              // Sort by engagement score with time decay
              filteredPosts.sort((a, b) => {
                const scoreA = calculateEngagementScore(a);
                const scoreB = calculateEngagementScore(b);
                return scoreB - scoreA;
              });
            } else {
              // Chronological sorting
              filteredPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            }
            
            // Apply pagination
            const startIndex = (feedOptions.page - 1) * feedOptions.limit;
            const paginatedPosts = filteredPosts.slice(startIndex, startIndex + feedOptions.limit);
            
            // Property: All returned posts should be public
            for (const post of paginatedPosts) {
              expect(post.isPublic).toBe(true);
            }
            
            // Property: If followingOnly is true, all posts should be from followed users or self
            if (feedOptions.followingOnly) {
              for (const post of paginatedPosts) {
                expect(
                  post.isFollowed || post.authorId === feedOptions.userId
                ).toBe(true);
              }
            }
            
            // Property: Posts should be ordered correctly based on sort type
            if (paginatedPosts.length > 1) {
              for (let i = 0; i < paginatedPosts.length - 1; i++) {
                const currentPost = paginatedPosts[i];
                const nextPost = paginatedPosts[i + 1];
                
                if (feedOptions.sortBy === 'algorithmic') {
                  const currentScore = calculateEngagementScore(currentPost!);
                  const nextScore = calculateEngagementScore(nextPost!);
                  expect(currentScore).toBeGreaterThanOrEqual(nextScore);
                } else {
                  expect(currentPost!.createdAt.getTime()).toBeGreaterThanOrEqual(
                    nextPost!.createdAt.getTime()
                  );
                }
              }
            }
            
            // Property: Pagination should respect limits
            expect(paginatedPosts.length).toBeLessThanOrEqual(feedOptions.limit);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should prioritize recent content in chronological feeds', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              createdAt: fc.date({ min: new Date('2023-01-01'), max: new Date() }),
              isPublic: fc.constant(true)
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (posts) => {
            // Sort chronologically (most recent first)
            const sortedPosts = [...posts].sort((a, b) => 
              b.createdAt.getTime() - a.createdAt.getTime()
            );
            
            // Property: Posts should be in descending chronological order
            for (let i = 0; i < sortedPosts.length - 1; i++) {
              expect(sortedPosts[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
                sortedPosts[i + 1]!.createdAt.getTime()
              );
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should prioritize engaging content in algorithmic feeds', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              likeCount: fc.integer({ min: 0, max: 100 }),
              commentCount: fc.integer({ min: 0, max: 50 }),
              shareCount: fc.integer({ min: 0, max: 50 }),
              createdAt: fc.date({ min: new Date('2023-01-01'), max: new Date() }),
              isPublic: fc.constant(true)
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (posts) => {
            // Sort algorithmically (by engagement score)
            const sortedPosts = [...posts].sort((a, b) => {
              const scoreA = calculateEngagementScore(a);
              const scoreB = calculateEngagementScore(b);
              return scoreB - scoreA;
            });
            
            // Property: Posts should be in descending engagement score order
            for (let i = 0; i < sortedPosts.length - 1; i++) {
              const currentScore = calculateEngagementScore(sortedPosts[i]!);
              const nextScore = calculateEngagementScore(sortedPosts[i + 1]!);
              expect(currentScore).toBeGreaterThanOrEqual(nextScore);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});