import Joi from 'joi';

// Common validation schemas
export const emailSchema = Joi.string().email().required();
export const passwordSchema = Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required();
export const usernameSchema = Joi.string().alphanum().min(3).max(30).required();

// Environment validation
export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
}).unknown(true);

export const validateEnvironment = (): void => {
  const { error } = environmentSchema.validate(process.env);
  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }
};