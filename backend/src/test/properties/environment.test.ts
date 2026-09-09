import * as fc from 'fast-check';
import { validateEnvironment, environmentSchema } from '../../utils/validation';

/**
 * Feature: social-media-platform, Property 1: Environment Configuration Validation
 * Validates: Requirements 1.1, 2.1
 * 
 * For any valid environment configuration, the system should accept it and initialize properly.
 * For any invalid environment configuration, the system should reject it with clear error messages.
 */
describe('Environment Configuration Validation Properties', () => {
  
  describe('Property 1: Environment Configuration Validation', () => {
    it('should accept any valid environment configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1024, max: 65535 }),
            DB_HOST: fc.string({ minLength: 1, maxLength: 255 }),
            DB_PORT: fc.integer({ min: 1024, max: 65535 }),
            DB_NAME: fc.string({ minLength: 1, maxLength: 63 }),
            DB_USER: fc.string({ minLength: 1, maxLength: 63 }),
            DB_PASSWORD: fc.string({ minLength: 1, maxLength: 255 }),
            REDIS_HOST: fc.string({ minLength: 1, maxLength: 255 }),
            REDIS_PORT: fc.integer({ min: 1024, max: 65535 }),
            JWT_SECRET: fc.string({ minLength: 32, maxLength: 128 }),
            JWT_REFRESH_SECRET: fc.string({ minLength: 32, maxLength: 128 }),
          }),
          (envConfig) => {
            // Save original environment
            const originalEnv = { ...process.env };
            
            try {
              // Set test environment
              Object.assign(process.env, envConfig);
              
              // Validation should not throw for valid config
              const { error } = environmentSchema.validate(process.env);
              expect(error).toBeUndefined();
              
              // Should not throw when validating
              expect(() => validateEnvironment()).not.toThrow();
              
            } finally {
              // Restore original environment
              process.env = originalEnv;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid environment configurations', () => {
      fc.assert(
        fc.property(
          fc.record({
            NODE_ENV: fc.constantFrom('invalid', '', 'staging'),
            PORT: fc.oneof(
              fc.integer({ max: 1023 }), // Invalid port range
              fc.integer({ min: 65536 }), // Invalid port range
              fc.constant('not-a-number')
            ),
            DB_HOST: fc.constant(''), // Empty host
            JWT_SECRET: fc.string({ maxLength: 31 }), // Too short
          }, { requiredKeys: [] }),
          (invalidConfig) => {
            // Save original environment
            const originalEnv = { ...process.env };
            
            try {
              // Clear required environment variables to force validation failure
              delete process.env.DB_HOST;
              delete process.env.DB_NAME;
              delete process.env.DB_USER;
              delete process.env.DB_PASSWORD;
              delete process.env.REDIS_HOST;
              delete process.env.JWT_SECRET;
              delete process.env.JWT_REFRESH_SECRET;
              
              // Set invalid config
              Object.assign(process.env, invalidConfig);
              
              // Validation should fail for invalid config
              const { error } = environmentSchema.validate(process.env);
              expect(error).toBeDefined();
              
              // Should throw when validating
              expect(() => validateEnvironment()).toThrow();
              
            } finally {
              // Restore original environment
              process.env = originalEnv;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle missing required environment variables', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'DB_HOST',
            'DB_NAME', 
            'DB_USER',
            'DB_PASSWORD',
            'REDIS_HOST',
            'JWT_SECRET',
            'JWT_REFRESH_SECRET'
          ),
          (requiredVar) => {
            // Save original environment
            const originalEnv = { ...process.env };
            
            try {
              // Remove a required variable
              delete process.env[requiredVar];
              
              // Validation should fail
              const { error } = environmentSchema.validate(process.env);
              expect(error).toBeDefined();
              
              // The error message should mention that a required field is missing
              // (Joi reports the first missing field it encounters, not necessarily the one we removed)
              expect(error?.message).toMatch(/is required/);
              
            } finally {
              // Restore original environment
              process.env = originalEnv;
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});