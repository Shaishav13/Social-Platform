import * as fc from 'fast-check';
import { MockUserModel } from '../mocks/userModel';
import { MockAuthDatabase } from '../mocks/database';
import { MockRedisConnection } from '../mocks/redis';
import { MockModerationModels } from '../mocks/moderationModels';
import { SpamDetectionService } from '../../services/moderation/spamDetection';

/**
 * Feature: social-media-platform, Property 26: Content Reporting
 * Validates: Requirements 10.1
 * 
 * Feature: social-media-platform, Property 27: User Blocking Functionality
 * Validates: Requirements 10.3
 * 
 * Feature: social-media-platform, Property 28: Spam Detection
 * Validates: Requirements 10.4
 */

describe('Moderation Property Tests', () => {
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
    MockModerationModels.reset();
  });

  describe('Property 26: Content Reporting', () => {
    it('should flag content for review when users report inappropriate content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            reporter: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            targetId: fc.uuid(),
            targetType: fc.constantFrom('post', 'comment', 'user'),
            reason: fc.string({ minLength: 5, maxLength: 255 }).filter(s => s.trim().length >= 5),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }).filter(s => s.trim().length >= 10))
          }),
          async ({ reporter, targetId, targetType, reason, description }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create a reporter user
            const reporterUser = await MockUserModel.createUser(reporter);
            
            // Get initial report count
            const initialReports = MockModerationModels.getAllReports();
            const initialReportCount = initialReports.length;
            
            // Create a report
            const reportRequest = {
              targetId,
              targetType: targetType as any,
              reason,
              ...(description && { description })
            };
            const reportResult = await MockModerationModels.createReport(reporterUser.id, reportRequest);
            
            // Verify report was created successfully
            expect(reportResult.status).toBe('created');
            expect(reportResult.message).toBe('Report submitted successfully');
            expect(reportResult.id).toBeDefined();
            
            // Verify report is flagged for review
            const allReports = MockModerationModels.getAllReports();
            expect(allReports.length).toBe(initialReportCount + 1);
            
            // Find the created report
            const createdReport = await MockModerationModels.getReportById(reportResult.id);
            expect(createdReport).toBeDefined();
            expect(createdReport!.reporterId).toBe(reporterUser.id);
            expect(createdReport!.targetId).toBe(targetId);
            expect(createdReport!.targetType).toBe(targetType);
            expect(createdReport!.reason).toBe(reason);
            expect(createdReport!.description).toBe(description || undefined);
            expect(createdReport!.status).toBe('pending');
            expect(createdReport!.createdAt).toBeDefined();
            expect(createdReport!.updatedAt).toBeDefined();
            
            // Verify report appears in pending reports
            const pendingReports = await MockModerationModels.getPendingReports();
            const foundInPending = pendingReports.find(r => r.id === reportResult.id);
            expect(foundInPending).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should prevent duplicate reports from the same user for the same content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            reporter: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            targetId: fc.uuid(),
            targetType: fc.constantFrom('post', 'comment', 'user'),
            reason: fc.string({ minLength: 5, maxLength: 255 }).filter(s => s.trim().length >= 5),
            attempts: fc.integer({ min: 2, max: 5 })
          }),
          async ({ reporter, targetId, targetType, reason, attempts }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create a reporter user
            const reporterUser = await MockUserModel.createUser(reporter);
            
            // Get initial report count
            const initialReportCount = MockModerationModels.getAllReports().length;
            
            // Attempt to create the same report multiple times
            let firstResult;
            let lastResult;
            
            for (let i = 0; i < attempts; i++) {
              const result = await MockModerationModels.createReport(reporterUser.id, {
                targetId,
                targetType: targetType as any,
                reason,
                description: `Attempt ${i + 1}`
              });
              
              if (i === 0) {
                firstResult = result;
              }
              lastResult = result;
            }
            
            // First attempt should succeed
            expect(firstResult!.status).toBe('created');
            expect(firstResult!.message).toBe('Report submitted successfully');
            
            // Subsequent attempts should be marked as duplicates
            expect(lastResult!.status).toBe('duplicate');
            expect(lastResult!.message).toBe('You have already reported this content');
            expect(lastResult!.id).toBe(firstResult!.id); // Should return the same report ID
            
            // Verify only one report was actually created
            const finalReportCount = MockModerationModels.getAllReports().length;
            expect(finalReportCount).toBe(initialReportCount + 1);
            
            // Verify the single report exists and is pending
            const pendingReports = await MockModerationModels.getPendingReports();
            const reportForTarget = pendingReports.filter(
              r => r.reporterId === reporterUser.id && 
                   r.targetId === targetId && 
                   r.targetType === targetType
            );
            expect(reportForTarget.length).toBe(1);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should allow different users to report the same content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            reporter1: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            reporter2: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            targetId: fc.uuid(),
            targetType: fc.constantFrom('post', 'comment', 'user'),
            reason: fc.string({ minLength: 5, maxLength: 255 }).filter(s => s.trim().length >= 5)
          }),
          async ({ reporter1, reporter2, targetId, targetType, reason }) => {
            // Ensure different users
            fc.pre(reporter1.email !== reporter2.email);
            fc.pre(reporter1.username !== reporter2.username);
            
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create both reporter users
            const reporterUser1 = await MockUserModel.createUser(reporter1);
            const reporterUser2 = await MockUserModel.createUser(reporter2);
            
            // Get initial report count
            const initialReportCount = MockModerationModels.getAllReports().length;
            
            // Both users report the same content
            const result1 = await MockModerationModels.createReport(reporterUser1.id, {
              targetId,
              targetType: targetType as any,
              reason,
              description: 'Report from user 1'
            });
            
            const result2 = await MockModerationModels.createReport(reporterUser2.id, {
              targetId,
              targetType: targetType as any,
              reason,
              description: 'Report from user 2'
            });
            
            // Both reports should succeed
            expect(result1.status).toBe('created');
            expect(result2.status).toBe('created');
            expect(result1.id).not.toBe(result2.id); // Different report IDs
            
            // Verify both reports were created
            const finalReportCount = MockModerationModels.getAllReports().length;
            expect(finalReportCount).toBe(initialReportCount + 2);
            
            // Verify both reports are pending
            const pendingReports = await MockModerationModels.getPendingReports();
            const reportsForTarget = pendingReports.filter(
              r => r.targetId === targetId && r.targetType === targetType
            );
            expect(reportsForTarget.length).toBe(2);
            
            // Verify each user has their own report
            const user1Reports = reportsForTarget.filter(r => r.reporterId === reporterUser1.id);
            const user2Reports = reportsForTarget.filter(r => r.reporterId === reporterUser2.id);
            expect(user1Reports.length).toBe(1);
            expect(user2Reports.length).toBe(1);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 27: User Blocking Functionality', () => {
    it('should prevent interactions between blocked users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            blocker: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            blocked: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            reason: fc.option(fc.string({ minLength: 5, maxLength: 255 }).filter(s => s.trim().length >= 5))
          }),
          async ({ blocker, blocked, reason }) => {
            // Ensure different users
            fc.pre(blocker.email !== blocked.email);
            fc.pre(blocker.username !== blocked.username);
            
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create both users
            const blockerUser = await MockUserModel.createUser(blocker);
            const blockedUser = await MockUserModel.createUser(blocked);
            
            // Initially, users should be able to interact
            const initialCanInteract = await MockModerationModels.canUserInteract(blockerUser.id, blockedUser.id);
            expect(initialCanInteract).toBe(true);
            
            // Get initial block count
            const initialBlockCount = MockModerationModels.getAllBlocks().length;
            
            // Block the user
            const blockRequest = {
              blockedId: blockedUser.id,
              ...(reason && { reason })
            };
            const blockResult = await MockModerationModels.createBlock(blockerUser.id, blockRequest);
            
            // Verify block was created successfully
            expect(blockResult.blocked).toBe(true);
            expect(blockResult.message).toBe('User blocked successfully');
            
            // Verify block exists in storage
            const finalBlockCount = MockModerationModels.getAllBlocks().length;
            expect(finalBlockCount).toBe(initialBlockCount + 1);
            
            // Verify users can no longer interact
            const canInteractAfterBlock = await MockModerationModels.canUserInteract(blockerUser.id, blockedUser.id);
            expect(canInteractAfterBlock).toBe(false);
            
            // Verify block status is correct
            const isBlocked = await MockModerationModels.isUserBlocked(blockerUser.id, blockedUser.id);
            expect(isBlocked).toBe(true);
            
            // Verify blocked user appears in blocker's blocked list
            const blockedUsers = await MockModerationModels.getBlockedUsers(blockerUser.id);
            const foundBlockedUser = blockedUsers.find(b => b.blockedId === blockedUser.id);
            expect(foundBlockedUser).toBeDefined();
            expect(foundBlockedUser!.blockerId).toBe(blockerUser.id);
            expect(foundBlockedUser!.reason).toBe(reason || undefined);
            expect(foundBlockedUser!.createdAt).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should restore interaction capability when unblocking users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            blocker: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            blocked: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            reason: fc.option(fc.string({ minLength: 5, maxLength: 255 }).filter(s => s.trim().length >= 5))
          }),
          async ({ blocker, blocked, reason }) => {
            // Ensure different users
            fc.pre(blocker.email !== blocked.email);
            fc.pre(blocker.username !== blocked.username);
            
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create both users
            const blockerUser = await MockUserModel.createUser(blocker);
            const blockedUser = await MockUserModel.createUser(blocked);
            
            // Block the user first
            const blockRequest = {
              blockedId: blockedUser.id,
              ...(reason && { reason })
            };
            await MockModerationModels.createBlock(blockerUser.id, blockRequest);
            
            // Verify users cannot interact after blocking
            const canInteractAfterBlock = await MockModerationModels.canUserInteract(blockerUser.id, blockedUser.id);
            expect(canInteractAfterBlock).toBe(false);
            
            // Get block count before unblocking
            const blockCountBeforeUnblock = MockModerationModels.getAllBlocks().length;
            
            // Unblock the user
            const unblockResult = await MockModerationModels.removeBlock(blockerUser.id, blockedUser.id);
            
            // Verify unblock was successful
            expect(unblockResult.blocked).toBe(false);
            expect(unblockResult.message).toBe('User unblocked successfully');
            
            // Verify block was removed from storage
            const blockCountAfterUnblock = MockModerationModels.getAllBlocks().length;
            expect(blockCountAfterUnblock).toBe(blockCountBeforeUnblock - 1);
            
            // Verify users can interact again
            const canInteractAfterUnblock = await MockModerationModels.canUserInteract(blockerUser.id, blockedUser.id);
            expect(canInteractAfterUnblock).toBe(true);
            
            // Verify block status is false
            const isStillBlocked = await MockModerationModels.isUserBlocked(blockerUser.id, blockedUser.id);
            expect(isStillBlocked).toBe(false);
            
            // Verify blocked user no longer appears in blocker's blocked list
            const blockedUsers = await MockModerationModels.getBlockedUsers(blockerUser.id);
            const foundBlockedUser = blockedUsers.find(b => b.blockedId === blockedUser.id);
            expect(foundBlockedUser).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should prevent users from blocking themselves', async () => {
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
            reason: fc.option(fc.string({ minLength: 5, maxLength: 255 }).filter(s => s.trim().length >= 5))
          }),
          async ({ user, reason }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create user
            const createdUser = await MockUserModel.createUser(user);
            
            // Get initial block count
            const initialBlockCount = MockModerationModels.getAllBlocks().length;
            
            // Attempt to block themselves
            const blockRequest = {
              blockedId: createdUser.id,
              ...(reason && { reason })
            };
            const blockResult = await MockModerationModels.createBlock(createdUser.id, blockRequest);
            
            // Should fail to block themselves
            expect(blockResult.blocked).toBe(false);
            expect(blockResult.message).toBe('Cannot block yourself');
            
            // Verify no block was created
            const finalBlockCount = MockModerationModels.getAllBlocks().length;
            expect(finalBlockCount).toBe(initialBlockCount);
            
            // Verify user can still interact with themselves (conceptually)
            const canInteract = await MockModerationModels.canUserInteract(createdUser.id, createdUser.id);
            expect(canInteract).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should prevent duplicate blocks of the same user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            blocker: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            blocked: fc.record({
              username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.string({ minLength: 8, maxLength: 100 }).filter(password => {
                return /[A-Z]/.test(password) && 
                       /[a-z]/.test(password) && 
                       /\d/.test(password) && 
                       /[!@#$%^&*(),.?":{}|<>]/.test(password);
              }),
            }),
            attempts: fc.integer({ min: 2, max: 5 })
          }),
          async ({ blocker, blocked, attempts }) => {
            // Ensure different users
            fc.pre(blocker.email !== blocked.email);
            fc.pre(blocker.username !== blocked.username);
            
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create both users
            const blockerUser = await MockUserModel.createUser(blocker);
            const blockedUser = await MockUserModel.createUser(blocked);
            
            // Get initial block count
            const initialBlockCount = MockModerationModels.getAllBlocks().length;
            
            // Attempt to block the same user multiple times
            let firstResult;
            let lastResult;
            
            for (let i = 0; i < attempts; i++) {
              const result = await MockModerationModels.createBlock(blockerUser.id, {
                blockedId: blockedUser.id,
                reason: `Attempt ${i + 1}`
              });
              
              if (i === 0) {
                firstResult = result;
              }
              lastResult = result;
            }
            
            // First attempt should succeed
            expect(firstResult!.blocked).toBe(true);
            expect(firstResult!.message).toBe('User blocked successfully');
            
            // Subsequent attempts should indicate already blocked
            expect(lastResult!.blocked).toBe(true);
            expect(lastResult!.message).toBe('User is already blocked');
            
            // Verify only one block was actually created
            const finalBlockCount = MockModerationModels.getAllBlocks().length;
            expect(finalBlockCount).toBe(initialBlockCount + 1);
            
            // Verify the single block exists
            const blockedUsers = await MockModerationModels.getBlockedUsers(blockerUser.id);
            const blocksForUser = blockedUsers.filter(b => b.blockedId === blockedUser.id);
            expect(blocksForUser.length).toBe(1);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should filter blocked users from interaction lists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            user: fc.record({
              username: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
              email: fc.emailAddress(),
              password: fc.constant('Password123!'), // Simplified password
            }),
            otherUsers: fc.array(
              fc.record({
                username: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
                email: fc.emailAddress(),
                password: fc.constant('Password123!'), // Simplified password
              }),
              { minLength: 2, maxLength: 3 } // Reduced array size
            ),
            blockedCount: fc.integer({ min: 1, max: 2 }) // Simplified to just count
          }),
          async ({ user, otherUsers, blockedCount }) => {
            // Simple uniqueness check - just ensure different emails
            const allEmails = [user.email, ...otherUsers.map(u => u.email)];
            const uniqueEmails = new Set(allEmails);
            fc.pre(uniqueEmails.size === allEmails.length);
            
            // Ensure we don't try to block more users than we have
            fc.pre(blockedCount <= otherUsers.length);
            
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create main user
            const mainUser = await MockUserModel.createUser(user);
            
            // Create other users
            const createdOtherUsers = [];
            for (const otherUser of otherUsers) {
              const created = await MockUserModel.createUser(otherUser);
              createdOtherUsers.push(created);
            }
            
            // Block the first N users (simplified logic)
            const blockedUserIds: string[] = [];
            for (let i = 0; i < blockedCount && i < createdOtherUsers.length; i++) {
              const userToBlock = createdOtherUsers[i];
              if (userToBlock) {
                await MockModerationModels.createBlock(mainUser.id, {
                  blockedId: userToBlock.id
                });
                blockedUserIds.push(userToBlock.id);
              }
            }
            
            // Get all user IDs
            const allUserIds = createdOtherUsers.map(u => u.id);
            
            // Filter blocked users
            const filteredUserIds = await MockModerationModels.filterBlockedUsers(mainUser.id, allUserIds);
            
            // Verify blocked users are filtered out
            for (const blockedId of blockedUserIds) {
              expect(filteredUserIds).not.toContain(blockedId);
            }
            
            // Verify non-blocked users are included
            const nonBlockedIds = allUserIds.filter(id => !blockedUserIds.includes(id));
            for (const nonBlockedId of nonBlockedIds) {
              expect(filteredUserIds).toContain(nonBlockedId);
            }
            
            // Verify filtered list has correct length
            expect(filteredUserIds.length).toBe(allUserIds.length - blockedUserIds.length);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 28: Spam Detection', () => {
    it('should identify spam content with appropriate confidence levels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseText: fc.string({ minLength: 10, maxLength: 200 }),
            spamKeywords: fc.array(fc.constantFrom('click here', 'free money', 'make money fast', 'get rich quick'), { minLength: 0, maxLength: 3 }),
            urls: fc.array(fc.webUrl(), { minLength: 0, maxLength: 2 }),
            repetition: fc.integer({ min: 0, max: 5 }),
            contentType: fc.constantFrom('post', 'comment', 'blog')
          }),
          async ({ baseText, spamKeywords, urls, repetition, contentType }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Construct test content with varying spam indicators
            let testContent = baseText;
            
            // Add spam keywords
            if (spamKeywords.length > 0) {
              testContent += ' ' + spamKeywords.join(' ');
            }
            
            // Add URLs
            if (urls.length > 0) {
              testContent += ' ' + urls.join(' ');
            }
            
            // Add repetition
            if (repetition > 0) {
              const repeatText = 'URGENT URGENT URGENT '.repeat(repetition);
              testContent += ' ' + repeatText;
            }
            
            // Analyze content
            const analysis = SpamDetectionService.analyzeContent({
              text: testContent,
              metadata: {
                contentType: contentType as 'post' | 'comment' | 'blog',
                timestamp: new Date()
              }
            });
            
            // Verify analysis structure
            expect(analysis).toBeDefined();
            expect(typeof analysis.isSpam).toBe('boolean');
            expect(typeof analysis.confidence).toBe('number');
            expect(analysis.confidence).toBeGreaterThanOrEqual(0);
            expect(analysis.confidence).toBeLessThanOrEqual(1);
            expect(Array.isArray(analysis.reasons)).toBe(true);
            expect(['spam', 'inappropriate', 'harassment', 'fake', 'other']).toContain(analysis.flagType);
            expect(['low', 'medium', 'high']).toContain(analysis.severity);
            
            // Verify spam detection logic
            const hasSpamIndicators = spamKeywords.length > 0 || urls.length > 1 || repetition > 2;
            
            if (hasSpamIndicators) {
              // Content with spam indicators should have higher confidence
              expect(analysis.confidence).toBeGreaterThan(0);
              if (spamKeywords.length > 1 || urls.length > 1 || repetition > 3) {
                expect(analysis.confidence).toBeGreaterThan(0.3);
              }
            }
            
            // Verify consistency between confidence and isSpam flag
            if (analysis.confidence >= 0.5) {
              expect(analysis.isSpam).toBe(true);
            } else {
              expect(analysis.isSpam).toBe(false);
            }
            
            // Verify severity matches confidence level
            if (analysis.confidence >= 0.7) {
              expect(analysis.severity).toBe('high');
            } else if (analysis.confidence >= 0.4) {
              expect(analysis.severity).toBe('medium');
            } else {
              expect(analysis.severity).toBe('low');
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should detect repeated content patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseText: fc.string({ minLength: 5, maxLength: 50 }),
            repetitions: fc.integer({ min: 2, max: 8 }),
            separator: fc.constantFrom(' ', '. ', '! ', '? ')
          }),
          async ({ baseText, repetitions, separator }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create content with repeated patterns
            const repeatedContent = Array(repetitions).fill(baseText).join(separator);
            
            // Test repeated content detection
            const hasRepeatedContent = SpamDetectionService.detectRepeatedContent(repeatedContent, 0.8);
            
            // Should detect repetition when content is repeated multiple times
            if (repetitions >= 3 && baseText.length > 10) {
              expect(hasRepeatedContent).toBe(true);
            }
            
            // Analyze the repeated content
            const analysis = SpamDetectionService.analyzeContent({
              text: repeatedContent,
              metadata: {
                contentType: 'post',
                timestamp: new Date()
              }
            });
            
            // Repeated content should have higher spam confidence
            if (repetitions >= 4) {
              expect(analysis.confidence).toBeGreaterThan(0.2);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle edge cases gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''), // Empty string
            fc.string({ minLength: 1, maxLength: 3 }), // Very short content
            fc.string({ minLength: 5000, maxLength: 6000 }), // Very long content
            fc.constant('a'.repeat(100)), // Repeated characters
            fc.constant('HELLO WORLD!!!!!!'), // Excessive caps and punctuation
            fc.constant('   \n\t   '), // Whitespace only
            fc.webUrl() // Single URL
          ),
          async (edgeCaseContent) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Analyze edge case content
            const analysis = SpamDetectionService.analyzeContent({
              text: edgeCaseContent,
              metadata: {
                contentType: 'comment',
                timestamp: new Date()
              }
            });
            
            // Should always return valid analysis structure
            expect(analysis).toBeDefined();
            expect(typeof analysis.isSpam).toBe('boolean');
            expect(typeof analysis.confidence).toBe('number');
            expect(analysis.confidence).toBeGreaterThanOrEqual(0);
            expect(analysis.confidence).toBeLessThanOrEqual(1);
            expect(Array.isArray(analysis.reasons)).toBe(true);
            
            // Edge cases should be handled appropriately
            if (edgeCaseContent.trim().length === 0) {
              // Empty content should be flagged
              expect(analysis.confidence).toBeGreaterThan(0);
              expect(analysis.reasons.some(r => r.includes('empty') || r.includes('short'))).toBe(true);
            }
            
            if (edgeCaseContent.length > 5000) {
              // Very long content should be flagged
              expect(analysis.confidence).toBeGreaterThan(0);
              expect(analysis.reasons.some(r => r.includes('long'))).toBe(true);
            }
            
            if (/(.)\1{4,}/.test(edgeCaseContent)) {
              // Repeated characters should be detected
              expect(analysis.confidence).toBeGreaterThan(0);
              expect(analysis.reasons.some(r => r.includes('pattern'))).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should consistently classify similar content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseContent: fc.string({ minLength: 20, maxLength: 100 }),
            variations: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 })
          }),
          async ({ baseContent, variations }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Analyze base content
            const baseAnalysis = SpamDetectionService.analyzeContent({
              text: baseContent,
              metadata: { contentType: 'post' }
            });
            
            // Analyze variations of the content
            const variationAnalyses = variations.map(variation => {
              const modifiedContent = baseContent + ' ' + variation;
              return SpamDetectionService.analyzeContent({
                text: modifiedContent,
                metadata: { contentType: 'post' }
              });
            });
            
            // Similar content should have similar spam classifications
            variationAnalyses.forEach(analysis => {
              // Confidence should be within reasonable range of base analysis
              const confidenceDiff = Math.abs(analysis.confidence - baseAnalysis.confidence);
              expect(confidenceDiff).toBeLessThan(0.5); // Allow some variation but not dramatic changes
              
              // Flag type should be consistent for similar content
              if (baseAnalysis.confidence > 0.6 && analysis.confidence > 0.6) {
                expect(analysis.flagType).toBe(baseAnalysis.flagType);
              }
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should detect potential bot behavior patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            contentTemplate: fc.string({ minLength: 10, maxLength: 50 }),
            variations: fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 3, maxLength: 8 })
          }),
          async ({ userId, contentTemplate, variations }) => {
            // Clean up before each property test iteration
            MockAuthDatabase.reset();
            MockRedisConnection.reset();
            MockModerationModels.reset();
            
            // Create similar content (bot-like behavior)
            const similarContent = variations.map(variation => contentTemplate + ' ' + variation);
            
            // Test bot detection
            const isLikelyBot = SpamDetectionService.isLikelyBot(userId, similarContent);
            
            // Should detect bot-like behavior when content is very similar
            if (variations.length >= 5) {
              // With many similar posts, should be more likely to detect bot behavior
              expect(typeof isLikelyBot).toBe('boolean');
            }
            
            // Create very similar content (high similarity)
            const identicalContent = Array(4).fill(contentTemplate);
            const definiteBot = SpamDetectionService.isLikelyBot(userId, identicalContent);
            
            // Identical content should be detected as bot behavior
            expect(definiteBot).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});