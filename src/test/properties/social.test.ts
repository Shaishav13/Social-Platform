import * as fc from 'fast-check';
import { MockUserModel } from '../mocks/userModel';
import { MockAuthDatabase } from '../mocks/database';
import { MockRedisConnection } from '../mocks/redis';
import { MockLikeModel, MockShareModel, MockCommentModel } from '../mocks/socialModels';
import { MockSocialDatabase } from '../mocks/socialDatabase';

/**
 * Feature: social-media-platform, Property 7: Like Action Round Trip
 * Validates: Requirements 3.1, 3.4
 * 
 * Feature: social-media-platform, Property 8: Duplicate Like Prevention
 * Validates: Requirements 3.5
 * 
 * Feature: social-media-platform, Property 9: Comment Persistence
 * Validates: Requirements 3.2
 * 
 * Feature: social-media-platform, Property 10: Share Action Recording
 * Validates: Requirements 3.3
 * 
 * Feature: social-media-platform, Property 20: Follow Relationship Impact
 * Validates: Requirements 7.3
 */

describe('Social Interaction Property Tests', () => {
  beforeAll(async () => {
    await MockRedisConnection.initialize();
    await MockAuthDatabase.createTables();
    await MockSocialDatabase.initializeTables();
  });

  afterAll(async () => {
    await MockRedisConnection.close();
  });

  beforeEach(async () => {
    // Clean up mock data before each test
    MockAuthDatabase.reset();
    MockRedisConnection.reset();
    MockSocialDatabase.reset();
  });

  describe('Property 7: Like Action Round Trip', () => {
    it('should restore original like count and remove user like record when liking then unliking any post', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            postId: fc.uuid()
          }),
          async ({ user, postId }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial like count for the post
            const initialLikeCount = await MockLikeModel.getLikeCount(postId, 'post');
            
            // Get initial like status
            const initialStatus = await MockLikeModel.getLikeStatus(createdUser.id, postId, 'post');
            
            // Like the post
            const likeResult = await MockLikeModel.toggleLike(createdUser.id, postId, 'post');
            
            // Verify like was recorded
            expect(likeResult.liked).toBe(true);
            expect(likeResult.likeCount).toBe(initialLikeCount + 1);
            
            // Unlike the post (toggle again)
            const unlikeResult = await MockLikeModel.toggleLike(createdUser.id, postId, 'post');
            
            // Verify unlike restored original state
            expect(unlikeResult.liked).toBe(false);
            expect(unlikeResult.likeCount).toBe(initialLikeCount);
            
            // Verify final status matches initial status
            const finalStatus = await MockLikeModel.getLikeStatus(createdUser.id, postId, 'post');
            expect(finalStatus.liked).toBe(initialStatus.liked);
            expect(finalStatus.likeCount).toBe(initialStatus.likeCount);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should restore original like count and remove user like record when liking then unliking any comment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            commentId: fc.uuid()
          }),
          async ({ user, commentId }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial like count for the comment
            const initialLikeCount = await MockLikeModel.getLikeCount(commentId, 'comment');
            
            // Get initial like status
            const initialStatus = await MockLikeModel.getLikeStatus(createdUser.id, commentId, 'comment');
            
            // Like the comment
            const likeResult = await MockLikeModel.toggleLike(createdUser.id, commentId, 'comment');
            
            // Verify like was recorded
            expect(likeResult.liked).toBe(true);
            expect(likeResult.likeCount).toBe(initialLikeCount + 1);
            
            // Unlike the comment (toggle again)
            const unlikeResult = await MockLikeModel.toggleLike(createdUser.id, commentId, 'comment');
            
            // Verify unlike restored original state
            expect(unlikeResult.liked).toBe(false);
            expect(unlikeResult.likeCount).toBe(initialLikeCount);
            
            // Verify final status matches initial status
            const finalStatus = await MockLikeModel.getLikeStatus(createdUser.id, commentId, 'comment');
            expect(finalStatus.liked).toBe(initialStatus.liked);
            expect(finalStatus.likeCount).toBe(initialStatus.likeCount);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 8: Duplicate Like Prevention', () => {
    it('should only record one like when attempting to like the same post multiple times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            postId: fc.uuid(),
            attempts: fc.integer({ min: 2, max: 5 })
          }),
          async ({ user, postId, attempts }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial like count
            const initialLikeCount = await MockLikeModel.getLikeCount(postId, 'post');
            
            // Attempt to like multiple times
            let lastResult;
            for (let i = 0; i < attempts; i++) {
              lastResult = await MockLikeModel.toggleLike(createdUser.id, postId, 'post');
            }
            
            // After odd number of attempts, should be liked
            // After even number of attempts, should be unliked
            const shouldBeLiked = attempts % 2 === 1;
            const expectedLikeCount = shouldBeLiked ? initialLikeCount + 1 : initialLikeCount;
            
            expect(lastResult!.liked).toBe(shouldBeLiked);
            expect(lastResult!.likeCount).toBe(expectedLikeCount);
            
            // Verify final status
            const finalStatus = await MockLikeModel.getLikeStatus(createdUser.id, postId, 'post');
            expect(finalStatus.liked).toBe(shouldBeLiked);
            expect(finalStatus.likeCount).toBe(expectedLikeCount);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should only record one like when attempting to like the same comment multiple times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            commentId: fc.uuid(),
            attempts: fc.integer({ min: 2, max: 5 })
          }),
          async ({ user, commentId, attempts }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial like count
            const initialLikeCount = await MockLikeModel.getLikeCount(commentId, 'comment');
            
            // Attempt to like multiple times
            let lastResult;
            for (let i = 0; i < attempts; i++) {
              lastResult = await MockLikeModel.toggleLike(createdUser.id, commentId, 'comment');
            }
            
            // After odd number of attempts, should be liked
            // After even number of attempts, should be unliked
            const shouldBeLiked = attempts % 2 === 1;
            const expectedLikeCount = shouldBeLiked ? initialLikeCount + 1 : initialLikeCount;
            
            expect(lastResult!.liked).toBe(shouldBeLiked);
            expect(lastResult!.likeCount).toBe(expectedLikeCount);
            
            // Verify final status
            const finalStatus = await MockLikeModel.getLikeStatus(createdUser.id, commentId, 'comment');
            expect(finalStatus.liked).toBe(shouldBeLiked);
            expect(finalStatus.likeCount).toBe(expectedLikeCount);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 9: Comment Persistence', () => {
    it('should save and make visible any valid comment content under the target post', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            postId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 2000 }).filter(s => s.trim().length > 0)
          }),
          async ({ user, postId, content }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial comment count for the post
            const initialComments = await MockSocialDatabase.getCommentsByPost(postId);
            const initialCommentCount = initialComments.length;
            
            // Create a comment
            const comment = await MockCommentModel.createComment(postId, createdUser.id, { content });
            
            // Verify comment was created with correct data
            expect(comment.postId).toBe(postId);
            expect(comment.authorId).toBe(createdUser.id);
            expect(comment.content).toBe(content);
            expect(comment.id).toBeDefined();
            expect(comment.createdAt).toBeDefined();
            expect(comment.updatedAt).toBeDefined();
            expect(comment.likeCount).toBe(0);
            
            // Verify comment is visible under the post
            const commentsAfter = await MockSocialDatabase.getCommentsByPost(postId);
            expect(commentsAfter.length).toBe(initialCommentCount + 1);
            
            // Find the created comment in the list
            const foundComment = commentsAfter.find(c => c.id === comment.id);
            expect(foundComment).toBeDefined();
            expect(foundComment!.content).toBe(content);
            expect(foundComment!.authorId).toBe(createdUser.id);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 10: Share Action Recording', () => {
    it('should create a share record and increment share count for any user and post combination', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            postId: fc.uuid()
          }),
          async ({ user, postId }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial share count for the post
            const initialShareCount = await MockShareModel.getShareCount(postId);
            
            // Get initial share status
            const initialStatus = await MockShareModel.getShareStatus(createdUser.id, postId);
            
            // Share the post
            const shareResult = await MockShareModel.sharePost(createdUser.id, postId);
            
            // Verify share was recorded
            expect(shareResult.shared).toBe(true);
            expect(shareResult.shareCount).toBe(initialShareCount + 1);
            
            // Verify share status is updated
            const finalStatus = await MockShareModel.getShareStatus(createdUser.id, postId);
            expect(finalStatus.shared).toBe(true);
            expect(finalStatus.shareCount).toBe(initialShareCount + 1);
            
            // Verify share count increased
            const finalShareCount = await MockShareModel.getShareCount(postId);
            expect(finalShareCount).toBe(initialShareCount + 1);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not create duplicate shares when sharing the same post multiple times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            postId: fc.uuid(),
            attempts: fc.integer({ min: 2, max: 5 })
          }),
          async ({ user, postId, attempts }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create a user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial share count
            const initialShareCount = await MockShareModel.getShareCount(postId);
            
            // Attempt to share multiple times
            let lastResult;
            for (let i = 0; i < attempts; i++) {
              lastResult = await MockShareModel.sharePost(createdUser.id, postId);
            }
            
            // Should always be shared with count incremented by only 1
            expect(lastResult!.shared).toBe(true);
            expect(lastResult!.shareCount).toBe(initialShareCount + 1);
            
            // Verify final status
            const finalStatus = await MockShareModel.getShareStatus(createdUser.id, postId);
            expect(finalStatus.shared).toBe(true);
            expect(finalStatus.shareCount).toBe(initialShareCount + 1);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 20: Follow Relationship Impact', () => {
    it('should establish follow relationship when following and remove it when unfollowing for any user pair', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            follower: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            following: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            })
          }),
          async ({ follower, following }) => {
            // Ensure different users
            fc.pre(follower.email !== following.email);
            fc.pre(follower.username !== following.username);
            
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create both users
            const followerUser = await MockUserModel.createUser(follower);
            const followingUser = await MockUserModel.createUser(following);
            
            // Get initial follow counts
            const initialFollowerCount = await MockSocialDatabase.getFollowerCount(followingUser.id);
            const initialFollowingCount = await MockSocialDatabase.getFollowingCount(followerUser.id);
            
            // Get initial follow status
            const initialStatus = await MockSocialDatabase.isFollowing(followerUser.id, followingUser.id);
            expect(initialStatus).toBe(false);
            
            // Follow the user
            const followResult = await MockSocialDatabase.createFollow(followerUser.id, followingUser.id);
            expect(followResult.followerId).toBe(followerUser.id);
            expect(followResult.followingId).toBe(followingUser.id);
            expect(followResult.id).toBeDefined();
            expect(followResult.createdAt).toBeDefined();
            
            // Verify follow relationship is established
            const followStatus = await MockSocialDatabase.isFollowing(followerUser.id, followingUser.id);
            expect(followStatus).toBe(true);
            
            // Verify follow counts increased
            const newFollowerCount = await MockSocialDatabase.getFollowerCount(followingUser.id);
            const newFollowingCount = await MockSocialDatabase.getFollowingCount(followerUser.id);
            expect(newFollowerCount).toBe(initialFollowerCount + 1);
            expect(newFollowingCount).toBe(initialFollowingCount + 1);
            
            // Unfollow the user
            const unfollowResult = await MockSocialDatabase.deleteFollow(followerUser.id, followingUser.id);
            expect(unfollowResult).toBe(true);
            
            // Verify follow relationship is removed
            const unfollowStatus = await MockSocialDatabase.isFollowing(followerUser.id, followingUser.id);
            expect(unfollowStatus).toBe(false);
            
            // Verify follow counts restored
            const finalFollowerCount = await MockSocialDatabase.getFollowerCount(followingUser.id);
            const finalFollowingCount = await MockSocialDatabase.getFollowingCount(followerUser.id);
            expect(finalFollowerCount).toBe(initialFollowerCount);
            expect(finalFollowingCount).toBe(initialFollowingCount);
          }
        ),
        { numRuns: 10 }
      );
    }, 15000);

    it('should prevent users from following themselves', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            })
          }),
          async ({ user }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockSocialDatabase.reset();
            
            // Create user
            const createdUser = await MockUserModel.createUser(user);
            
            // Attempt to follow themselves should fail
            let errorThrown = false;
            try {
              await MockSocialDatabase.createFollow(createdUser.id, createdUser.id);
            } catch (error) {
              errorThrown = true;
            }
            
            // Should throw an error or be prevented by database constraints
            // In our mock, the database constraint should prevent this
            expect(errorThrown).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    }, 15000);
  });
});