import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment-specific configuration
export class ProductionConfig {
  private static instance: ProductionConfig;
  private config: any = {};

  private constructor() {
    this.loadConfiguration();
  }

  static getInstance(): ProductionConfig {
    if (!ProductionConfig.instance) {
      ProductionConfig.instance = new ProductionConfig();
    }
    return ProductionConfig.instance;
  }

  private loadConfiguration() {
    // Load base environment variables
    config();

    // Environment-specific settings
    const environment = process.env.NODE_ENV || 'development';
    
    this.config = {
      // Server configuration
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || '0.0.0.0',
        environment,
        apiPrefix: process.env.API_PREFIX || '/api/v1',
        trustProxy: process.env.TRUST_PROXY === 'true',
      },

      // Database configuration
      database: {
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST || (process.env.DATABASE_URL ? 'remote' : 'localhost'),
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'social_media_platform',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: this.getSSLConfig(),
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
      },

      // Redis configuration
      redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || (process.env.REDIS_URL ? 'remote' : 'localhost'),
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '0', 10),
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true,
      },

      // Security configuration
      security: {
        jwtSecret: process.env.JWT_SECRET || this.generateSecretKey(),
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || this.generateSecretKey(),
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
        jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        sessionSecret: process.env.SESSION_SECRET || this.generateSecretKey(),
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },

      // File storage configuration
      storage: {
        type: process.env.STORAGE_TYPE || 'local', // 'local' | 's3' | 'gcs'
        uploadPath: process.env.UPLOAD_PATH || './uploads',
        maxFileSize: process.env.MAX_FILE_SIZE || '10mb',
        allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'video/mp4', 'video/webm', 'video/ogg'
        ],
        // S3 configuration (if using S3)
        s3: {
          bucket: process.env.S3_BUCKET || '',
          region: process.env.S3_REGION || 'us-east-1',
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          endpoint: process.env.S3_ENDPOINT || '',
        },
      },

      // Logging configuration
      logging: {
        level: process.env.LOG_LEVEL || (environment === 'production' ? 'info' : 'debug'),
        format: process.env.LOG_FORMAT || 'combined',
        enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
        logDirectory: process.env.LOG_DIRECTORY || './logs',
        maxLogFiles: parseInt(process.env.MAX_LOG_FILES || '10', 10),
        maxLogSize: process.env.MAX_LOG_SIZE || '10m',
      },

      // Performance configuration
      performance: {
        enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
        compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        cacheDefaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10), // 1 hour
        enableMetrics: process.env.ENABLE_METRICS === 'true',
        metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000', 10), // 1 minute
      },

      // Monitoring configuration
      monitoring: {
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
        enableAlerts: process.env.ENABLE_ALERTS === 'true',
        alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
        enableAPM: process.env.ENABLE_APM === 'true',
        apmServiceName: process.env.APM_SERVICE_NAME || 'social-media-platform',
      },

      // Feature flags
      features: {
        enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
        enableFileUploads: process.env.ENABLE_FILE_UPLOADS !== 'false',
        enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
        enableSearch: process.env.ENABLE_SEARCH !== 'false',
        enableModeration: process.env.ENABLE_MODERATION !== 'false',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      },
    };

    // Validate critical configuration
    this.validateConfiguration();
  }

  private getSSLConfig() {
    if (process.env.NODE_ENV === 'production') {
      const sslConfig: any = { rejectUnauthorized: true };
      
      if (process.env.DB_SSL_CERT) {
        sslConfig.cert = readFileSync(process.env.DB_SSL_CERT);
      }
      if (process.env.DB_SSL_KEY) {
        sslConfig.key = readFileSync(process.env.DB_SSL_KEY);
      }
      if (process.env.DB_SSL_CA) {
        sslConfig.ca = readFileSync(process.env.DB_SSL_CA);
      }
      
      return sslConfig;
    }
    
    return process.env.DB_SSL === 'true';
  }

  private generateSecretKey(): string {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Secret keys must be provided in production environment');
    }
    
    // Generate a random key for development
    return require('crypto').randomBytes(64).toString('hex');
  }

  private validateConfiguration() {
    const required = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'DB_PASSWORD'
    ];

    if (process.env.NODE_ENV === 'production') {
      const missing = required.filter(key => !process.env[key]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
      }

      // Additional production validations
      if (this.config.security.corsOrigins.includes('*')) {
        throw new Error('Wildcard CORS origins not allowed in production');
      }

      if (this.config.security.jwtSecret.length < 32) {
        throw new Error('JWT secret must be at least 32 characters in production');
      }
    }
  }

  get(path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  getAll(): any {
    return { ...this.config };
  }

  // Environment helpers
  isDevelopment(): boolean {
    return this.config.server.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.server.environment === 'production';
  }

  isTest(): boolean {
    return this.config.server.environment === 'test';
  }
}

// SSL/TLS Configuration
export class SSLConfig {
  static getHTTPSOptions() {
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    const httpsOptions: any = {};

    if (process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
      try {
        httpsOptions.cert = readFileSync(process.env.SSL_CERT_PATH);
        httpsOptions.key = readFileSync(process.env.SSL_KEY_PATH);
        
        if (process.env.SSL_CA_PATH) {
          httpsOptions.ca = readFileSync(process.env.SSL_CA_PATH);
        }
        
        return httpsOptions;
      } catch (error) {
        console.error('Failed to load SSL certificates:', error);
        throw new Error('SSL certificates could not be loaded');
      }
    }

    return null;
  }

  static requireHTTPS() {
    return (req: any, res: any, next: any) => {
      if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.get('host')}${req.url}`);
      }
      next();
    };
  }
}

// Environment validation
export function validateEnvironment() {
  const config = ProductionConfig.getInstance();
  
  console.log('🔧 Validating environment configuration...');
  
  // Check database connection
  if (!process.env.DATABASE_URL && !config.get('database.host')) {
    throw new Error('Database host or DATABASE_URL not configured');
  }
  
  // Check Redis connection
  if (!process.env.REDIS_URL && !config.get('redis.host')) {
    console.warn('⚠️  Redis host/REDIS_URL not configured - some features may not work');
  }
  
  // Check file storage
  if (config.get('storage.type') === 's3' && !config.get('storage.s3.bucket')) {
    throw new Error('S3 bucket not configured for S3 storage type');
  }

  // Security check for production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.warn('⚠️  SECURITY WARNING: In production, JWT_SECRET should be explicitly set and at least 32 characters long!');
    }
  }
  
  console.log('✅ Environment configuration validated');
  
  return config;
}