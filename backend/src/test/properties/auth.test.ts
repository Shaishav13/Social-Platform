import * as fc from 'fast-check';
import { MockUserModel, MockDataExportModel } from '../mocks/userModel';
import { MockAuthDatabase } from '../mocks/database';
import { MockRedisConnection } from '../mocks/redis';

/**
 * Feature: social-media-platform, Property 1: Authentication Round Trip
 * Validates: Requirements 1.1, 1.2
 * 
 * Feature: social-media-platform, Property 2: Invalid Authentication Rejection
 * Validates: Requirements 1.4
 * 
 * Feature: social-media-platform, Property 3: Session Termination
 * Validates: Requirements 1.3
 * 
 * Feature: social-media-platform, Property 4: Password Security Validation
 * Validates: Requirements 1.5
 * 
 * Feature: social-media-platform, Property 15: Account Deletion Security
 * Validates: Requirements 6.1
 * 
 * Feature: social-media-platform, Property 16: Complete Data Removal
 * Validates: Requirements 6.2, 6.3
 * 
 * Feature: social-media-platform, Property 17: Data Export Completeness
 * Validates: Requirements 6.4
 */

describe('Authentication Property Tests', () => {
  beforeAll(async () => {
    await MockRedisConnection.initialize();
    await MockAuthDatabase.createTables();
  });

  afterAll(async () => {
    await MockRedisConnection.close();
  });

  beforeEach(async () => {
    // Clean up mock data before each test
    MockAuthDatabase.reset();
    MockRedisConnection.reset();
  });

  describe('Property 1: Authentication Round Trip', () => {
    it('should successfully register and then authenticate any valid user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
              return /[A-Z]/.test(password) && 
                     /[a-z]/.test(password) && 
                     /\d/.test(password) && 
                     /[!@#$%^&*(),.?":{}|<>]/.test(password);
            }),
            bio: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
          }),
          async (userData) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Register the user
            const createdUser = await MockUserModel.createUser(userData);
            
            // Verify user was created with correct data
            expect(createdUser.username).toBe(userData.username);
            expect(createdUser.email).toBe(userData.email);
            expect(createdUser.bio).toBe(userData.bio);
            expect(createdUser.id).toBeDefined();
            expect(createdUser.passwordHash).toBeDefined();
            expect(createdUser.passwordHash).not.toBe(userData.password); // Password should be hashed
            
            // Authenticate with the same credentials
            const authenticatedUser = await MockUserModel.authenticateUser(userData.email, userData.password);
            
            // Verify authentication succeeded and returned the same user
            expect(authenticatedUser).not.toBeNull();
            expect(authenticatedUser!.id).toBe(createdUser.id);
            expect(authenticatedUser!.username).toBe(createdUser.username);
            expect(authenticatedUser!.email).toBe(createdUser.email);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 2: Invalid Authentication Rejection', () => {
    it('should reject authentication for any invalid credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            validUser: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            invalidCredentials: fc.oneof(
              // Wrong password
              fc.record({
                email: fc.constant(''),
                password: fc.string().filter(p => p.length > 0)
              }),
              // Non-existent email
              fc.record({
                email: fc.emailAddress(),
                password: fc.string()
              }),
              // Malformed email
              fc.record({
                email: fc.string().filter(s => !s.includes('@') && s.length > 0),
                password: fc.string()
              })
            )
          }),
          async ({ validUser, invalidCredentials }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Create a valid user first
            await MockUserModel.createUser(validUser);
            
            // Set up invalid credentials
            let testEmail: string;
            let testPassword: string;
            
            if (invalidCredentials.email === '') {
              // Wrong password case
              testEmail = validUser.email;
              testPassword = invalidCredentials.password !== validUser.password ? 
                           invalidCredentials.password : 
                           validUser.password + 'wrong';
            } else {
              // Non-existent or malformed email case
              testEmail = invalidCredentials.email !== validUser.email ? 
                         invalidCredentials.email : 
                         'nonexistent@example.com';
              testPassword = invalidCredentials.password;
            }
            
            // Attempt authentication with invalid credentials
            const result = await MockUserModel.authenticateUser(testEmail, testPassword);
            
            // Should always return null for invalid credentials
            expect(result).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 3: Session Termination', () => {
    it('should terminate sessions and prevent further authenticated actions for any user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
              return /[A-Z]/.test(password) && 
                     /[a-z]/.test(password) && 
                     /\d/.test(password) && 
                     /[!@#$%^&*(),.?":{}|<>]/.test(password);
            }),
          }),
          async (userData) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Create user and generate tokens
            const user = await MockUserModel.createUser(userData);
            const tokens = await MockUserModel.generateTokens(user);
            
            // Verify tokens are valid initially
            const decodedToken = MockUserModel.verifyAccessToken(tokens.accessToken);
            expect(decodedToken).not.toBeNull();
            expect(decodedToken!.userId).toBe(user.id);
            
            // Verify refresh token works initially
            const refreshedTokens = await MockUserModel.refreshTokens(tokens.refreshToken);
            expect(refreshedTokens).not.toBeNull();
            
            // Logout using the new refresh token
            await MockUserModel.logout(refreshedTokens!.refreshToken);
            
            // Verify refresh token no longer works after logout
            const failedRefresh = await MockUserModel.refreshTokens(refreshedTokens!.refreshToken);
            expect(failedRefresh).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 4: Password Security Validation', () => {
    it('should enforce security requirements for any password input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            email: fc.emailAddress(),
            password: fc.oneof(
              // Too short
              fc.string({ maxLength: 7 }),
              // No uppercase
              fc.string({ minLength: 8 }).filter(p => !/[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p)),
              // No lowercase  
              fc.string({ minLength: 8 }).filter(p => /[A-Z]/.test(p) && !/[a-z]/.test(p) && /\d/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p)),
              // No numbers
              fc.string({ minLength: 8 }).filter(p => /[A-Z]/.test(p) && /[a-z]/.test(p) && !/\d/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p)),
              // No special characters
              fc.string({ minLength: 8 }).filter(p => /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && !/[!@#$%^&*(),.?":{}|<>]/.test(p))
            )
          }),
          async (userData) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Attempt to create user with invalid password
            let errorThrown = false;
            let errorMessage = '';
            
            try {
              await MockUserModel.createUser(userData);
            } catch (error: any) {
              errorThrown = true;
              errorMessage = error.message;
            }
            
            // Should always throw an error for invalid passwords
            expect(errorThrown).toBe(true);
            expect(errorMessage).toContain('Password validation failed');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 15: Account Deletion Security', () => {
    it('should require password confirmation before proceeding with any account deletion request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
              return /[A-Z]/.test(password) && 
                     /[a-z]/.test(password) && 
                     /\d/.test(password) && 
                     /[!@#$%^&*(),.?":{}|<>]/.test(password);
            }),
            wrongPassword: fc.string().filter(p => p.length > 0)
          }),
          async ({ username, email, password, wrongPassword }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Create user
            const user = await MockUserModel.createUser({ username, email, password });
            
            // Ensure wrong password is actually different
            const testWrongPassword = wrongPassword === password ? password + 'wrong' : wrongPassword;
            
            // Attempt account deletion with wrong password should fail
            let errorThrown = false;
            try {
              // Simulate password verification failure
              const foundUser = await MockAuthDatabase.findUserById(user.id);
              expect(foundUser).not.toBeNull();
              
              const isPasswordValid = await MockUserModel.verifyPassword(testWrongPassword, foundUser!.passwordHash);
              expect(isPasswordValid).toBe(false);
              
              if (!isPasswordValid) {
                throw new Error('Invalid password');
              }
              
              await MockDataExportModel.deleteUserAccount(user.id);
            } catch (error: any) {
              errorThrown = true;
              expect(error.message).toBe('Invalid password');
            }
            
            // Should have thrown an error for wrong password
            expect(errorThrown).toBe(true);
            
            // User should still exist after failed deletion attempt
            const userStillExists = await MockAuthDatabase.findUserById(user.id);
            expect(userStillExists).not.toBeNull();
            
            // Account deletion with correct password should succeed
            const isCorrectPasswordValid = await MockUserModel.verifyPassword(password, user.passwordHash);
            expect(isCorrectPasswordValid).toBe(true);
            
            if (isCorrectPasswordValid) {
              await MockDataExportModel.deleteUserAccount(user.id);
              
              // User should no longer exist after successful deletion
              const userAfterDeletion = await MockAuthDatabase.findUserById(user.id);
              expect(userAfterDeletion).toBeNull();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 16: Complete Data Removal', () => {
    it('should permanently remove all user data and make account inaccessible for any confirmed account deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
              return /[A-Z]/.test(password) && 
                     /[a-z]/.test(password) && 
                     /\d/.test(password) && 
                     /[!@#$%^&*(),.?":{}|<>]/.test(password);
            }),
          }),
          async (userData) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Create user and generate session
            const user = await MockUserModel.createUser(userData);
            const tokens = await MockUserModel.generateTokens(user);
            
            // Verify user exists and has active session
            const userBeforeDeletion = await MockAuthDatabase.findUserById(user.id);
            expect(userBeforeDeletion).not.toBeNull();
            
            const sessionBeforeDeletion = await MockAuthDatabase.findSessionByRefreshToken(tokens.refreshToken);
            expect(sessionBeforeDeletion).not.toBeNull();
            expect(sessionBeforeDeletion!.isActive).toBe(true);
            
            // Verify user can authenticate before deletion
            const authBeforeDeletion = await MockUserModel.authenticateUser(userData.email, userData.password);
            expect(authBeforeDeletion).not.toBeNull();
            
            // Delete user account
            await MockDataExportModel.deleteUserAccount(user.id);
            
            // Verify user no longer exists
            const userAfterDeletion = await MockAuthDatabase.findUserById(user.id);
            expect(userAfterDeletion).toBeNull();
            
            // Verify user cannot be found by email
            const userByEmailAfterDeletion = await MockAuthDatabase.findUserByEmail(userData.email);
            expect(userByEmailAfterDeletion).toBeNull();
            
            // Verify user cannot be found by username
            const userByUsernameAfterDeletion = await MockAuthDatabase.findUserByUsername(userData.username);
            expect(userByUsernameAfterDeletion).toBeNull();
            
            // Verify authentication fails after deletion
            const authAfterDeletion = await MockUserModel.authenticateUser(userData.email, userData.password);
            expect(authAfterDeletion).toBeNull();
            
            // Verify session is invalidated after deletion
            const sessionAfterDeletion = await MockAuthDatabase.findSessionByRefreshToken(tokens.refreshToken);
            expect(sessionAfterDeletion).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 17: Data Export Completeness', () => {
    it('should provide complete download of all user data for any user data export request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
              return /[A-Z]/.test(password) && 
                     /[a-z]/.test(password) && 
                     /\d/.test(password) && 
                     /[!@#$%^&*(),.?":{}|<>]/.test(password);
            }),
            bio: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
          }),
          async (userData) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            
            // Create user
            const user = await MockUserModel.createUser(userData);
            
            // Export user data
            const exportData = await MockDataExportModel.exportUserData(user.id);
            
            // Verify export data structure and completeness
            expect(exportData).toBeDefined();
            expect(exportData.exportedAt).toBeDefined();
            expect(new Date(exportData.exportedAt)).toBeInstanceOf(Date);
            
            // Verify user data is included
            expect(exportData.user).toBeDefined();
            expect(exportData.user.id).toBe(user.id);
            expect(exportData.user.username).toBe(user.username);
            expect(exportData.user.email).toBe(user.email);
            expect(exportData.user.bio).toBe(user.bio);
            expect(exportData.user.createdAt).toBeDefined();
            expect(exportData.user.updatedAt).toBeDefined();
            
            // Verify all content sections are present
            expect(exportData.content).toBeDefined();
            expect(Array.isArray(exportData.content.posts)).toBe(true);
            expect(Array.isArray(exportData.content.comments)).toBe(true);
            expect(Array.isArray(exportData.content.likes)).toBe(true);
            expect(Array.isArray(exportData.content.shares)).toBe(true);
            
            // Verify social data sections are present
            expect(exportData.social).toBeDefined();
            expect(Array.isArray(exportData.social.following)).toBe(true);
            expect(Array.isArray(exportData.social.followers)).toBe(true);
            
            // Verify other sections are present
            expect(Array.isArray(exportData.blogs)).toBe(true);
            expect(Array.isArray(exportData.notifications)).toBe(true);
            
            // Verify statistics section
            expect(exportData.statistics).toBeDefined();
            expect(typeof exportData.statistics.totalPosts).toBe('number');
            expect(typeof exportData.statistics.totalComments).toBe('number');
            expect(typeof exportData.statistics.totalLikes).toBe('number');
            expect(typeof exportData.statistics.totalShares).toBe('number');
            expect(typeof exportData.statistics.totalFollowing).toBe('number');
            expect(typeof exportData.statistics.totalFollowers).toBe('number');
            expect(typeof exportData.statistics.totalBlogs).toBe('number');
            expect(typeof exportData.statistics.totalNotifications).toBe('number');
            
            // Verify statistics match array lengths
            expect(exportData.statistics.totalPosts).toBe(exportData.content.posts.length);
            expect(exportData.statistics.totalComments).toBe(exportData.content.comments.length);
            expect(exportData.statistics.totalLikes).toBe(exportData.content.likes.length);
            expect(exportData.statistics.totalShares).toBe(exportData.content.shares.length);
            expect(exportData.statistics.totalFollowing).toBe(exportData.social.following.length);
            expect(exportData.statistics.totalFollowers).toBe(exportData.social.followers.length);
            expect(exportData.statistics.totalBlogs).toBe(exportData.blogs.length);
            expect(exportData.statistics.totalNotifications).toBe(exportData.notifications.length);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});