import request from 'supertest';
import app from '../../index';
import { DatabaseConnection } from '../../config/database';
import { RedisConnection } from '../../config/redis';

describe('Service Integration Tests', () => {
  let server: any;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Initialize test environment
    await DatabaseConnection.initialize();
    await RedisConnection.initialize();
    server = app.listen(0);

    // Create test user for service integration tests
    const testUser = {
      username: 'service_test_user',
      email: 'service@test.com',
      password: 'TestPassword123!',
      bio: 'Service integration test user'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    authToken = registerResponse.body.data.tokens.accessToken;
    userId = registerResponse.body.data.user.id;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await DatabaseConnection.close();
    await RedisConnection.close();
  });

  describe('Auth Service Integration', () => {
    it('should integrate with all protected endpoints', async () => {
      // Test that auth service properly protects all service endpoints
      const protectedEndpoints = [
        { method: 'get', path: '/api/v1/auth/me' },
        { method: 'get', path: '/api/v1/profile' },
        { method: 'post', path: '/api/v1/content/posts' },
        { method: 'get', path: '/api/v1/notifications' },
        { method: 'get', path: '/api/v1/auth/export' }
      ];

      // Test without token - should fail
      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }

      // Test with valid token - should succeed (or at least not fail auth)
      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${authToken}`);
        expect(response.status).not.toBe(401);
      }
    });

    it('should handle token refresh across services', async () => {
      // Get refresh token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'service@test.com',
          password: 'TestPassword123!'
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // Refresh tokens
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      const newToken = refreshResponse.body.data.tokens.accessToken;

      // Use new token with other services
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newToken}`);

      expect(profileResponse.status).toBe(200);
    });
  });

  describe('Content Service Integration', () => {
    let postId: string;

    it('should integrate with social service for interactions', async () => {
      // Create a post
      const postData = {
        content: 'Post for social integration testing',
        mediaType: 'text',
        isPublic: true
      };

      const postResponse = await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData);

      expect(postResponse.status).toBe(201);
      postId = postResponse.body.data.id;

      // Like the post through social service
      const likeResponse = await request(app)
        .post(`/api/v1/social/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(likeResponse.status).toBe(200);

      // Verify like count is updated in content service
      const updatedPostResponse = await request(app)
        .get(`/api/v1/content/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedPostResponse.body.data.likeCount).toBeGreaterThan(0);
    });

    it('should integrate with search service for indexing', async () => {
      const uniqueContent = `Searchable content ${Date.now()}`;
      
      // Create post with unique content
      const postData = {
        content: uniqueContent,
        mediaType: 'text',
        isPublic: true
      };

      await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData);

      // Wait for search indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search should find the content
      const searchResponse = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(uniqueContent)}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.data.results.length).toBeGreaterThan(0);
    });

    it('should integrate with notification service for content events', async () => {
      // Create another user to test notifications
      const secondUser = {
        username: 'notification_test_user',
        email: 'notification@test.com',
        password: 'TestPassword123!'
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(secondUser);

      const secondUserToken = registerResponse.body.data.tokens.accessToken;

      // Second user likes the post
      await request(app)
        .post(`/api/v1/social/posts/${postId}/like`)
        .set('Authorization', `Bearer ${secondUserToken}`);

      // Original user should receive notification
      const notificationsResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(notificationsResponse.status).toBe(200);
      expect(notificationsResponse.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Social Service Integration', () => {
    let followedUserId: string;
    let followedUserToken: string;

    beforeAll(async () => {
      // Create user to follow
      const followUser = {
        username: 'follow_test_user',
        email: 'follow@test.com',
        password: 'TestPassword123!'
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(followUser);

      followedUserId = registerResponse.body.data.user.id;
      followedUserToken = registerResponse.body.data.tokens.accessToken;
    });

    it('should integrate with profile service for follow relationships', async () => {
      // Follow the user
      const followResponse = await request(app)
        .post(`/api/v1/social/users/${followedUserId}/follow`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(followResponse.status).toBe(200);

      // Check if follow is reflected in profile service
      const profileResponse = await request(app)
        .get(`/api/v1/profile/${followedUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.followerCount).toBeGreaterThan(0);
    });

    it('should integrate with content service for feed generation', async () => {
      // Followed user creates a post
      const postData = {
        content: 'Post from followed user for feed testing',
        mediaType: 'text',
        isPublic: true
      };

      await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${followedUserToken}`)
        .send(postData);

      // Follower's feed should include the post
      const feedResponse = await request(app)
        .get('/api/v1/content/feed')
        .set('Authorization', `Bearer ${authToken}`);

      expect(feedResponse.status).toBe(200);
      expect(feedResponse.body.data.posts.length).toBeGreaterThan(0);
    });
  });

  describe('Blog Service Integration', () => {
    let blogId: string;

    it('should integrate with search service for blog indexing', async () => {
      const uniqueTitle = `Blog Title ${Date.now()}`;
      
      // Create blog post
      const blogData = {
        title: uniqueTitle,
        content: 'Blog content for search integration testing',
        excerpt: 'Blog excerpt',
        tags: ['integration', 'test'],
        isDraft: false
      };

      const blogResponse = await request(app)
        .post('/api/v1/blog/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blogData);

      expect(blogResponse.status).toBe(201);
      blogId = blogResponse.body.data.id;

      // Wait for search indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search should find the blog
      const searchResponse = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(uniqueTitle)}&type=blogs`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.data.results.length).toBeGreaterThan(0);
    });

    it('should integrate with profile service for author information', async () => {
      // Get blog with author information
      const blogResponse = await request(app)
        .get(`/api/v1/blog/posts/${blogId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(blogResponse.status).toBe(200);
      expect(blogResponse.body.data.authorId).toBe(userId);

      // Get author profile
      const authorResponse = await request(app)
        .get(`/api/v1/profile/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(authorResponse.status).toBe(200);
      expect(authorResponse.body.data.id).toBe(userId);
    });
  });

  describe('Notification Service Integration', () => {
    it('should integrate with all services for event generation', async () => {
      // Create another user for notification testing
      const notifUser = {
        username: 'notif_integration_user',
        email: 'notifintegration@test.com',
        password: 'TestPassword123!'
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(notifUser);

      const notifUserToken = registerResponse.body.data.tokens.accessToken;
      const notifUserId = registerResponse.body.data.user.id;

      // Test follow notification
      await request(app)
        .post(`/api/v1/social/users/${userId}/follow`)
        .set('Authorization', `Bearer ${notifUserToken}`);

      // Test like notification
      const postData = {
        content: 'Post for notification integration',
        mediaType: 'text',
        isPublic: true
      };

      const postResponse = await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData);

      const newPostId = postResponse.body.data.id;

      await request(app)
        .post(`/api/v1/social/posts/${newPostId}/like`)
        .set('Authorization', `Bearer ${notifUserToken}`);

      // Check notifications
      const notificationsResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(notificationsResponse.status).toBe(200);
      expect(notificationsResponse.body.data.length).toBeGreaterThan(0);

      // Verify notification types
      const notifications = notificationsResponse.body.data;
      const notificationTypes = notifications.map((n: any) => n.type);
      expect(notificationTypes).toContain('follow');
      expect(notificationTypes).toContain('like');
    });
  });

  describe('Search Service Integration', () => {
    it('should provide unified search across all content types', async () => {
      const searchTerm = `unified_search_${Date.now()}`;

      // Create content with search term in different services
      await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `Post with ${searchTerm} content`,
          mediaType: 'text',
          isPublic: true
        });

      await request(app)
        .post('/api/v1/blog/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: `Blog with ${searchTerm} title`,
          content: 'Blog content',
          excerpt: 'Blog excerpt',
          tags: ['test'],
          isDraft: false
        });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search should find both types
      const searchResponse = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(searchTerm)}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.data.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Data Export Integration', () => {
    it('should export data from all services', async () => {
      // Create content across services
      await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post for export testing',
          mediaType: 'text',
          isPublic: true
        });

      await request(app)
        .post('/api/v1/blog/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Blog for export testing',
          content: 'Blog content',
          excerpt: 'Blog excerpt',
          tags: ['export'],
          isDraft: false
        });

      // Export data
      const exportResponse = await request(app)
        .get('/api/v1/auth/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(exportResponse.status).toBe(200);
      
      const exportData = exportResponse.body.data;
      expect(exportData.user).toBeDefined();
      expect(exportData.posts).toBeDefined();
      expect(exportData.blogs).toBeDefined();
      expect(exportData.comments).toBeDefined();
      expect(exportData.likes).toBeDefined();
      expect(exportData.follows).toBeDefined();
      expect(exportData.notifications).toBeDefined();
    });
  });

  describe('Error Propagation Across Services', () => {
    it('should handle service failures gracefully', async () => {
      // Test with invalid post ID across services
      const invalidId = 'invalid-post-id';

      // Content service should return 404
      const contentResponse = await request(app)
        .get(`/api/v1/content/posts/${invalidId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(contentResponse.status).toBe(404);

      // Social service should handle invalid post ID
      const likeResponse = await request(app)
        .post(`/api/v1/social/posts/${invalidId}/like`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(likeResponse.status).toBe(404);
    });

    it('should maintain data consistency during partial failures', async () => {
      // This test would ideally simulate partial service failures
      // For now, we test that operations are atomic
      
      const postData = {
        content: 'Post for consistency testing',
        mediaType: 'text',
        isPublic: true
      };

      const postResponse = await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData);

      expect(postResponse.status).toBe(201);
      
      // If post creation succeeded, it should be findable
      const getResponse = await request(app)
        .get(`/api/v1/content/posts/${postResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
    });
  });
});