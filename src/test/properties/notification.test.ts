import * as fc from 'fast-check';
import { MockNotificationModel } from '../mocks/notificationModels';
import { MockNotificationEventHandlers } from '../mocks/notificationEventHandlers';
import { MockAuthDatabase } from '../mocks/database';
import { MockRedisConnection } from '../mocks/redis';
import { NotificationCreateRequest, Notification } from '../../services/notification/types';

/**
 * Feature: social-media-platform, Property 23: Notification Generation
 * Validates: Requirements 9.1, 9.2, 9.4
 * 
 * Feature: social-media-platform, Property 24: Mention Detection
 * Validates: Requirements 9.3
 * 
 * Feature: social-media-platform, Property 25: Notification Preferences
 * Validates: Requirements 9.5
 */

describe('Notification Property Tests', () => {
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
    MockNotificationModel.reset();
  });

  describe('Property 23: Notification Generation', () => {
    it('should generate appropriate notifications for any user interaction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            actorUser: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            targetUser: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            notificationType: fc.constantFrom('like', 'comment', 'follow', 'share', 'mention') as fc.Arbitrary<Notification['type']>,
            targetId: fc.uuid(),
          }),
          async ({ actorUser, targetUser, notificationType, targetId }) => {
            // Ensure users have different emails and usernames
            if (actorUser.email === targetUser.email || actorUser.username === targetUser.username) {
              return; // Skip this iteration
            }

            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockNotificationModel.reset();

            // Create both users
            const actor = await MockAuthDatabase.createUser({
              username: actorUser.username,
              email: actorUser.email,
              passwordHash: 'hashed_password',
              bio: undefined,
              profilePicture: undefined,
              isPrivate: false,
            });

            const target = await MockAuthDatabase.createUser({
              username: targetUser.username,
              email: targetUser.email,
              passwordHash: 'hashed_password',
              bio: undefined,
              profilePicture: undefined,
              isPrivate: false,
            });

            // Generate notification message
            const message = MockNotificationModel.generateNotificationMessage(notificationType, actor.username);

            // Create notification
            const notificationData: NotificationCreateRequest = {
              userId: target.id,
              type: notificationType,
              actorId: actor.id,
              targetId: targetId,
              message: message,
            };

            const notification = await MockNotificationModel.createNotification(notificationData);

            // Verify notification was created correctly
            expect(notification.userId).toBe(target.id);
            expect(notification.type).toBe(notificationType);
            expect(notification.actorId).toBe(actor.id);
            expect(notification.targetId).toBe(targetId);
            expect(notification.message).toContain(actor.username);
            expect(notification.isRead).toBe(false);
            expect(notification.id).toBeDefined();
            expect(notification.createdAt).toBeDefined();

            // Verify notification appears in user's notification list
            const userNotifications = await MockNotificationModel.getUserNotifications(target.id, 10, 0);
            expect(userNotifications).toContainEqual(
              expect.objectContaining({
                id: notification.id,
                userId: target.id,
                type: notificationType,
                actorId: actor.id,
              })
            );

            // Verify unread count is updated
            const unreadCount = await MockNotificationModel.getUnreadCount(target.id);
            expect(unreadCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 24: Mention Detection', () => {
    it('should detect and handle mentions in any content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            mentionedUsers: fc.array(
              fc.record({
                username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
                email: fc.emailAddress(),
              }),
              { minLength: 1, maxLength: 3 }
            ),
            content: fc.string({ minLength: 10, maxLength: 200 }),
            actorUser: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
            }),
            targetId: fc.uuid(),
          }),
          async ({ mentionedUsers, content, actorUser, targetId }) => {
            // Ensure all users have unique emails and usernames
            const allUsers = [...mentionedUsers, actorUser];
            const emails = allUsers.map(u => u.email);
            const usernames = allUsers.map(u => u.username);
            if (new Set(emails).size !== emails.length || new Set(usernames).size !== usernames.length) {
              return; // Skip this iteration
            }

            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockNotificationModel.reset();

            // Create actor user
            const actor = await MockAuthDatabase.createUser({
              username: actorUser.username,
              email: actorUser.email,
              passwordHash: 'hashed_password',
              bio: undefined,
              profilePicture: undefined,
              isPrivate: false,
            });

            // Create mentioned users and build content with mentions
            const createdMentionedUsers = [];
            let contentWithMentions = content;

            for (const userData of mentionedUsers) {
              const user = await MockAuthDatabase.createUser({
                username: userData.username,
                email: userData.email,
                passwordHash: 'hashed_password',
                bio: undefined,
                profilePicture: undefined,
                isPrivate: false,
              });
              createdMentionedUsers.push(user);
              
              // Add mention to content
              contentWithMentions += ` @${user.username}`;
            }

            // Detect mentions
            const detectedMentions = MockNotificationModel.detectMentions(contentWithMentions);

            // Verify all mentioned usernames are detected
            for (const user of createdMentionedUsers) {
              expect(detectedMentions).toContain(user.username);
            }

            // Handle mention event
            await MockNotificationEventHandlers.handleMentionEvent(
              contentWithMentions,
              actor.id,
              targetId,
              'post'
            );

            // Verify notifications were created for mentioned users
            for (const user of createdMentionedUsers) {
              const userNotifications = await MockNotificationModel.getUserNotifications(user.id, 10, 0);
              const mentionNotification = userNotifications.find(n => 
                n.type === 'mention' && 
                n.actorId === actor.id && 
                n.targetId === targetId
              );
              
              expect(mentionNotification).toBeDefined();
              expect(mentionNotification!.message).toContain(actor.username);
              expect(mentionNotification!.message).toContain('mentioned you');
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 25: Notification Preferences', () => {
    it('should respect user notification preferences for any notification type', async () => {
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
            actorUser: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
            }),
            preferences: fc.record({
              enableLikes: fc.boolean(),
              enableComments: fc.boolean(),
              enableFollows: fc.boolean(),
              enableShares: fc.boolean(),
              enableMentions: fc.boolean(),
              emailNotifications: fc.boolean(),
              pushNotifications: fc.boolean(),
            }),
            notificationType: fc.constantFrom('like', 'comment', 'follow', 'share', 'mention') as fc.Arbitrary<Notification['type']>,
            targetId: fc.uuid(),
          }),
          async ({ user, actorUser, preferences, notificationType, targetId }) => {
            // Ensure users have different emails and usernames
            if (user.email === actorUser.email || user.username === actorUser.username) {
              return; // Skip this iteration
            }

            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockNotificationModel.reset();

            // Create both users
            const targetUser = await MockAuthDatabase.createUser({
              username: user.username,
              email: user.email,
              passwordHash: 'hashed_password',
              bio: undefined,
              profilePicture: undefined,
              isPrivate: false,
            });

            const actor = await MockAuthDatabase.createUser({
              username: actorUser.username,
              email: actorUser.email,
              passwordHash: 'hashed_password',
              bio: undefined,
              profilePicture: undefined,
              isPrivate: false,
            });

            // Set user preferences
            await MockNotificationModel.updateUserPreferences(targetUser.id, preferences);

            // Determine if notification should be sent based on preferences
            let shouldSendNotification = true;
            switch (notificationType) {
              case 'like':
                shouldSendNotification = preferences.enableLikes;
                break;
              case 'comment':
                shouldSendNotification = preferences.enableComments;
                break;
              case 'follow':
                shouldSendNotification = preferences.enableFollows;
                break;
              case 'share':
                shouldSendNotification = preferences.enableShares;
                break;
              case 'mention':
                shouldSendNotification = preferences.enableMentions;
                break;
            }

            // Generate notification message
            const message = MockNotificationModel.generateNotificationMessage(notificationType, actor.username);

            // Create notification request
            const notificationData: NotificationCreateRequest = {
              userId: targetUser.id,
              type: notificationType,
              actorId: actor.id,
              targetId: targetId,
              message: message,
            };

            if (shouldSendNotification) {
              // Should succeed
              const notification = await MockNotificationModel.createNotification(notificationData);
              expect(notification).toBeDefined();
              expect(notification.userId).toBe(targetUser.id);
              expect(notification.type).toBe(notificationType);

              // Verify notification appears in user's list
              const userNotifications = await MockNotificationModel.getUserNotifications(targetUser.id, 10, 0);
              expect(userNotifications.length).toBeGreaterThan(0);
            } else {
              // Should throw error due to preferences
              await expect(MockNotificationModel.createNotification(notificationData))
                .rejects.toThrow(`User has disabled ${notificationType} notifications`);

              // Verify no notification was created
              const userNotifications = await MockNotificationModel.getUserNotifications(targetUser.id, 10, 0);
              const matchingNotification = userNotifications.find(n => 
                n.type === notificationType && 
                n.actorId === actor.id && 
                n.targetId === targetId
              );
              expect(matchingNotification).toBeUndefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});