import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisConnection } from '../config/redis';

let rateLimiterInstance: RateLimiterRedis;

export const updateRateLimiterPoints = (points: number): void => {
  if (rateLimiterInstance) {
    (rateLimiterInstance as any).points = points;
  }
};

// Initialize rate limiter (will be called after Redis connection is established)
export const initializeRateLimiter = (): void => {
  const redisClient = RedisConnection.getClient();
  
  rateLimiterInstance = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_',
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000, // Convert to seconds
    blockDuration: 60, // Block for 1 minute if limit exceeded
  });
};

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!rateLimiterInstance) {
    // If rate limiter is not initialized, skip rate limiting
    next();
    return;
  }

  try {
    const key = req.ip || 'unknown';
    await rateLimiterInstance.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round((rejRes as { msBeforeNext: number }).msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        retryAfter: secs,
      },
    });
  }
};

// Simple rate limiter for when Redis is not available
export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  // For now, just pass through - will be enhanced when Redis is properly connected
  next();
};