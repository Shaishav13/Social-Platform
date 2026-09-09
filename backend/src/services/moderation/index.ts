import { Pool } from 'pg';
import { ModerationDatabase } from './database';
import { ModerationModels } from './models';
import { createModerationRoutes } from './routes';
import { ContentValidationMiddleware, ContentRateLimiter, AutoModerationService, ModerationCleanupService } from './contentValidation';
import { SpamDetectionService } from './spamDetection';

export { 
  ModerationDatabase, 
  ModerationModels, 
  createModerationRoutes,
  ContentValidationMiddleware,
  ContentRateLimiter,
  AutoModerationService,
  ModerationCleanupService,
  SpamDetectionService
};
export * from './types';

export async function initializeModerationService(pool: Pool) {
  const database = new ModerationDatabase(pool);
  await database.initializeTables();
  
  const models = new ModerationModels(database);
  const routes = createModerationRoutes(models);
  
  // Set up periodic cleanup
  const cleanupInterval = setInterval(() => {
    ModerationCleanupService.cleanup();
  }, 5 * 60 * 1000); // Every 5 minutes

  return {
    database,
    models,
    routes,
    contentValidator: new ContentValidationMiddleware(models),
    autoModerationService: new AutoModerationService(models),
    cleanup: () => {
      clearInterval(cleanupInterval);
    }
  };
}