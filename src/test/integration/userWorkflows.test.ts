import request from 'supertest';
import app from '../../index';
import { DatabaseConnection } from '../../config/database';
import { RedisConnection } from '../../config/redis';

describe('User Workflows Integration Tests', () => {
  let server: any;
  let authToken: string;
  let refreshToken: string;
  let userId: string;
  let postId: string;
  let blogId: string;

  beforeAll(async () => {
    // Initialize test database and Redis
    await DatabaseConnection.initialize();
    await RedisConnection.initialize();
    
    // Start server for testing
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    // Clean up
    if (server) {
      server.close();
    }
    await DatabaseConnection.close();
    await RedisConnection.close();
  });

  describe('Complete User Journey: Registration to Content Creation', () => {
    const testUser = {
      username: 'testuser_integration',
      email: 'integration@test.com',
      password: 'TestPassword123!',
      bio: 'Integration test user'
    };

    it('should complete full user registration workflow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(testUser.email);
      expect(registerResponse.body.data.tokens.accessToken).toBeDefined();
      
      authToken = registerResponse.body.data.tokens.accessToken;
      refreshToken = registerResponse.body.data.tokens.refreshToken;
      userId = registerResponse.body.data.user.id;
    });

    it('should login with registered credentials', async () => {
      // Step 2: Login with credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
      
      // Update tokens from login
      authToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    it('should access protected profile endpoint', async () => {
      // Step 3: Access protected profile
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.email).toBe(testUser.email);
    });

    it('should update user profile', async () => {
      // Step 4: Update profile information
      const updateData = {
        bio: 'Updated bio for integration test',
        isPrivate: false
      };

      const updateResponse = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.bio).toBe(updateData.bio);
    });

    it('should create a text post', async () => {
      // Step 5: Create content
      const postData = {
        content: 'This is my first integration test post!',
        mediaType: 'text',
        isPublic: true
      };

      const postResponse = await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      expect(postResponse.body.success).toBe(true);
      expect(postResponse.body.data.content).toBe(postData.content);
      
      postId = postResponse.body.data.id;
    });

    it('should retrieve created post', async () => {
      // Step 6: Retrieve post
      const getPostResponse = await request(app)
        .get(`/api/v1/content/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getPostResponse.body.success).toBe(true);
      expect(getPostResponse.body.data.id).toBe(postId);
    });

    it('should like the created post', async () => {
      // Step 7: Social interaction - like post
      const likeResponse = await request(app)
        .post(`/api/v1/social/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(likeResponse.body.success).toBe(true);
    });

    it('should comment on the post', async () => {
      // Step 8: Social interaction - comment
      const commentData = {
        content: 'Great post! This is a test comment.'
      };

      const commentResponse = await request(app)
        .post(`/api/v1/social/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentData)
        .expect(201);

      expect(commentResponse.body.success).toBe(true);
      expect(commentResponse.body.data.content).toBe(commentData.content);
    });

    it('should create a blog post', async () => {
      // Step 9: Create blog content
      const blogData = {
        title: 'My Integration Test Blog',
        content: 'This is a comprehensive blog post for integration testing.',
        excerpt: 'Integration test blog excerpt',
        tags: ['test', 'integration'],
        isDraft: false
      };

      const blogResponse = await request(app)
        .post('/api/v1/blog/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blogData)
        .expect(201);

      expect(blogResponse.body.success).toBe(true);
      expect(blogResponse.body.data.title).toBe(blogData.title);
      
      blogId = blogResponse.body.data.id;
    });

    it('should search for created content', async () => {
      // Step 10: Search functionality
      const searchResponse = await request(app)
        .get('/api/v1/search?q=integration&type=posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(Array.isArray(searchResponse.body.data.results)).toBe(true);
    });

    it('should get user feed with created content', async () => {
      // Step 11: Feed functionality
      const feedResponse = await request(app)
        .get('/api/v1/content/feed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(feedResponse.body.success).toBe(true);
      expect(Array.isArray(feedResponse.body.data.posts)).toBe(true);
    });

    it('should export user data', async () => {
      // Step 12: Data export
      const exportResponse = await request(app)
        .get('/api/v1/auth/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(exportResponse.body.success).toBe(true);
      expect(exportResponse.body.data.user).toBeDefined();
      expect(exportResponse.body.data.posts).toBeDefined();
      expect(exportResponse.body.data.blogs).toBeDefined();
    });

    it('should logout successfully', async () => {
      // Step 13: Logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
    });

    it('should fail to access protected endpoint after logout', async () => {
      // Step 14: Verify logout
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });
  });

  describe('Cross-Service Data Consistency', () => {
    let secondUserId: string;
    let secondUserToken: string;

    beforeAll(async () => {
      // Create second user for interaction testing
      const secondUser = {
        username: 'testuser2_integration',
        email: 'integration2@test.com',
        password: 'TestPassword123!',
        bio: 'Second integration test user'
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(secondUser)
        .expect(201);

      secondUserId = registerResponse.body.data.user.id;
      secondUserToken = registerResponse.body.data.tokens.accessToken;
    });

    it('should maintain data consistency across services when user follows another', async () => {
      // Follow relationship should be reflected in profile and feed services
      const followResponse = await request(app)
        .post(`/api/v1/social/users/${userId}/follow`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);

      expect(followResponse.body.success).toBe(true);

      // Check if follow is reflected in profile
      const profileResponse = await request(app)
        .get(`/api/v1/profile/${userId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);

      expect(profileResponse.body.data.followerCount).toBeGreaterThan(0);
    });

    it('should maintain notification consistency across services', async () => {
      // Create a post and like it from another user - should generate notification
      const postData = {
        content: 'Post for notification testing',
        mediaType: 'text',
        isPublic: true
      };

      const postResponse = await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(postData)
        .expect(201);

      const newPostId = postResponse.body.data.id;

      // Like the post from first user
      await request(app)
        .post(`/api/v1/social/posts/${newPostId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check notifications for second user
      const notificationsResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);

      expect(notificationsResponse.body.success).toBe(true);
      expect(Array.isArray(notificationsResponse.body.data)).toBe(true);
    });

    it('should maintain search index consistency when content is created', async () => {
      const uniqueContent = `Unique searchable content ${Date.now()}`;
      
      // Create post with unique content
      const postData = {
        content: uniqueContent,
        mediaType: 'text',
        isPublic: true
      };

      await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
        .expect(201);

      // Wait a moment for search indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search should find the new content
      const searchResponse = await request(app)
        .get(`/api/v1/search?q=${encodeURIComponent(uniqueContent)}&type=posts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.results.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid authentication gracefully', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    it('should handle non-existent resource requests', async () => {
      await request(app)
        .get('/api/v1/content/posts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle malformed request data', async () => {
      await request(app)
        .post('/api/v1/content/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(400);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent user registrations', async () => {
      const concurrentUsers = Array(5).fill(null).map((_, index) => ({
        username: `concurrent_user_${index}_${Date.now()}`,
        email: `concurrent${index}@test.com`,
        password: 'TestPassword123!',
        bio: `Concurrent test user ${index}`
      }));

      const registrationPromises = concurrentUsers.map(user =>
        request(app)
          .post('/api/v1/auth/register')
          .send(user)
      );

      const responses = await Promise.all(registrationPromises);
      
      // All registrations should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle concurrent post creation', async () => {
      const posts = Array(5).fill(null).map((_, index) => ({
        content: `Concurrent post ${index} - ${Date.now()}`,
        mediaType: 'text',
        isPublic: true
      }));

      const postPromises = posts.map(post =>
        request(app)
          .post('/api/v1/content/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(post)
      );

      const responses = await Promise.all(postPromises);
      
      // All posts should be created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });
  });
});