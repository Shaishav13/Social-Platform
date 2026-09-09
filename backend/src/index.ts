/**
 * Social Platform - Main Server Entry Point
 * 
 * Copyright (c) 2025 Shaishav
 * Licensed under the MIT License
 * 
 * A modern social media platform with microservices architecture
 * Author: Shaishav <sk.shaishav.9@gmail.com>
 * GitHub: https://github.com/Shaishav13
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { DatabaseConnection } from './config/database';
import { RedisConnection } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { 
  securityHeaders, 
  apiRateLimit, 
  sanitizeInput, 
  securityLogger, 
  corsOptions,
  securityAudit 
} from './middleware/security';
import { AuthDatabase } from './services/auth/database';
import { ContentDatabase } from './services/content/database';
import { SocialDatabase } from './services/social/database';
import { ProfileDatabase } from './services/profile/database';
import { BlogDatabase } from './services/blog/database';
import { NotificationDatabase } from './services/notification/database';
import { notificationWebSocketService } from './services/notification/websocket';
import { fileStorageService } from './services/content/storage';
import { SearchService } from './services/search';
import { initializeModerationService } from './services/moderation';
import contentRoutes from './services/content/routes';
import socialRoutes from './services/social/routes';
import { profileRoutes } from './services/profile/routes';
import blogRoutes from './services/blog/routes';
import notificationRoutes from './services/notification/routes';
import searchRoutes from './services/search/routes';
import authRoutes from './services/auth/routes';
import adminRoutes from './services/admin/routes';
import { createModerationRoutes } from './services/moderation/routes';
import { InMemoryServiceRegistry, LoadBalancer, CircuitBreaker } from './gateway/serviceDiscovery';
import { MonitoringService } from './gateway/monitoring';
import { DatabaseOptimizer, QueryMonitor, ConnectionPoolMonitor } from './utils/performance';
import { SSLConfig, validateEnvironment } from './config/production';

// Load environment variables and validate configuration
dotenv.config();
const config = validateEnvironment();

const app = express();
const PORT = config.get('server.port');

// CRITICAL: Handle uploads FIRST, before ANY other middleware
const uploadsPath = config.get('storage.uploadPath');
import * as fs from 'fs';

// Handle uploads with complete CORS freedom - MUST BE FIRST
app.use('/uploads', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Set CORS headers FIRST, before any other processing
  const origin = req.headers.origin;
  const envOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
  const allowedOrigins = ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3000', 'http://localhost:5173', ...envOrigins];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  // Handle GET requests for files with strict path traversal & active content defense
  if (req.method === 'GET' || req.method === 'HEAD') {
    // Reject null byte injection attempts
    if (req.path.includes('\0') || req.path.includes('%00')) {
      res.status(400).json({ error: 'Invalid file path' });
      return;
    }

    const resolvedBase = path.resolve(uploadsPath);
    // Normalize and strip leading relative parent directory sequences
    const safePath = path.normalize(req.path).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.resolve(resolvedBase, '.' + safePath);

    // Strict boundary confinement check: prevent path traversal out of uploads directory
    if (!filePath.startsWith(resolvedBase + path.sep) && filePath !== resolvedBase) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Do not serve hidden or dot files (.env, .git, etc.)
    const baseName = path.basename(filePath);
    if (baseName.startsWith('.')) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      res.status(404).json({ error: 'Not a file' });
      return;
    }

    // Set content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm'
    };

    const contentType = contentTypes[ext];
    if (!contentType) {
      // Disallow non-whitelisted static file extensions from in-browser execution
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`);
    } else {
      res.setHeader('Content-Type', contentType);
      // For SVG files, strictly isolate active content / scripts
      if (ext === '.svg') {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      }
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());

    // Handle conditional requests
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    const etag = res.getHeader('ETag') as string;

    if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime)) {
      res.status(304).end();
      return;
    }

    // For HEAD requests, don't send body
    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    // Send file
    const stream = fs.createReadStream(filePath);
    stream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

    stream.pipe(res);
    return;
  }
  
  // For other methods, continue to next middleware
  next();
});

// Trust proxy if configured (for load balancers, reverse proxies)
if (config.get('server.trustProxy')) {
  app.set('trust proxy', 1);
}

// Initialize API Gateway and monitoring
const serviceRegistry = new InMemoryServiceRegistry();
const monitoring = new MonitoringService();

// Performance monitoring will be initialized after database connection

// Security middleware
app.use(securityHeaders);
app.use(securityLogger);
app.use(securityAudit);

// HTTPS redirect in production
if (config.isProduction()) {
  app.use(SSLConfig.requireHTTPS());
}

// CORS configuration
app.use(cors(corsOptions));

// General middleware
app.use(compression({
  level: config.get('performance.compressionLevel'),
  threshold: 1024 // Only compress responses > 1KB
}));

app.use(morgan(config.get('logging.format')));
app.use(express.json({ 
  limit: '500kb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '500kb'
}));

// Input sanitization
app.use(sanitizeInput);

// Monitoring middleware (temporarily disabled)
// app.use(monitoring.trackRequest());

// Rate limiting
app.use(apiRateLimit);

// Lightweight health check endpoint for uptime monitors
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Detailed diagnostic health check endpoint (restricted to localhost or internal network)
app.get('/health/detailed', async (req, res) => {
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  if (!isLocal && config.isProduction()) {
    return res.status(403).json({ error: 'Access denied: diagnostics restricted to internal network' });
  }

  const performanceSummary = monitoring.getPerformanceSummary();
  const alerts = monitoring.checkAlerts();
  const dbMetrics = await DatabaseOptimizer.getPerformanceMetrics();
  const poolStats = ConnectionPoolMonitor.getPoolStats();
  const queryStats = QueryMonitor.getQueryStats();
  
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.get('server.environment'),
    version: process.env.npm_package_version || '1.0.0',
    performance: performanceSummary,
    database: {
      connectionPool: poolStats,
      metrics: dbMetrics,
      slowQueries: queryStats.slice(0, 5)
    },
    alerts: alerts.length > 0 ? alerts : undefined,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    }
  };

  const criticalAlerts = alerts.filter(alert => alert.severity === 'high');
  const statusCode = criticalAlerts.length > 0 ? 503 : 200;
  res.status(statusCode).json(healthStatus);
});

// Detailed metrics endpoint (strictly restricted to localhost / internal monitoring)
app.get('/metrics', (req, res) => {
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  if (!isLocal) {
    return res.status(403).json({ error: 'Access denied: metrics restricted to internal monitoring' });
  }

  const allMetrics = monitoring.getAllMetrics();
  const performanceSummary = monitoring.getPerformanceSummary();
  const alerts = monitoring.checkAlerts();
  const poolStats = ConnectionPoolMonitor.getPoolStats();
  const queryStats = QueryMonitor.getQueryStats();
  
  return res.json({
    timestamp: new Date().toISOString(),
    summary: performanceSummary,
    services: Object.fromEntries(allMetrics),
    alerts,
    database: {
      connectionPool: poolStats,
      queryPerformance: queryStats
    },
    recentRequests: monitoring.getRecentRequests(50),
    errorRequests: monitoring.getErrorRequests(20)
  });
});

// Performance endpoint for database metrics
app.get('/performance', async (req, res) => {
  if (config.isProduction() && req.ip !== '127.0.0.1') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const dbMetrics = await DatabaseOptimizer.getPerformanceMetrics();
    return res.json({
      timestamp: new Date().toISOString(),
      database: dbMetrics,
      connectionPool: ConnectionPoolMonitor.getPoolStats(),
      queryStats: QueryMonitor.getQueryStats()
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve performance metrics' });
  }
});

// API routes
const API_PREFIX = config.get('server.apiPrefix');

// Avoid browser favicon 404 noise when no icon is provided
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

// Chrome DevTools may probe this endpoint automatically.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end();
});

// Root route to avoid noisy 404 logs on "/"
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'UdtaBirdie Socials Server',
    api: API_PREFIX,
    health: '/health'
  });
});

// Maintenance mode check
app.use((req, res, next) => {
  if (config.get('features.maintenanceMode') && !req.path.startsWith('/health')) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable for maintenance',
      retryAfter: 3600 // 1 hour
    });
  }
  return next();
});

// Authentication service routes
app.use(`${API_PREFIX}/auth`, authRoutes);

// Content service routes
app.use(`${API_PREFIX}/content`, contentRoutes);

// Social service routes
app.use(`${API_PREFIX}/social`, socialRoutes);

// Profile service routes
app.use(`${API_PREFIX}/profile`, profileRoutes);

// Blog service routes
app.use(`${API_PREFIX}/blog`, blogRoutes);

// Notification service routes
app.use(`${API_PREFIX}/notifications`, notificationRoutes);

// Search service routes
app.use(`${API_PREFIX}/search`, searchRoutes);

// Admin service routes (restricted to role=admin)
app.use(`${API_PREFIX}/admin`, adminRoutes);

// API base route
app.get(API_PREFIX, (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'UdtaBirdie Socials API',
    version: 'v1',
    health: '/health'
  });
});

// Moderation routes will be set up after service initialization

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    console.log('🚀 Starting Social Media Platform...');
    console.log(`📊 Environment: ${config.get('server.environment')}`);
    
    // Initialize database connection
    await DatabaseConnection.initialize();
    console.log('✅ Database connected successfully');

    // Initialize database tables
    await AuthDatabase.createTables();
    console.log('✅ Auth tables initialized');

    await ContentDatabase.initializeTables();
    console.log('✅ Content tables initialized');

    await SocialDatabase.initializeTables();
    console.log('✅ Social tables initialized');

    await ProfileDatabase.initialize();
    console.log('✅ Profile tables initialized');

    await BlogDatabase.initializeTables();
    console.log('✅ Blog tables initialized');

    await NotificationDatabase.createTables();
    console.log('✅ Notification tables initialized');

    // Initialize performance monitoring after all tables are created
    DatabaseOptimizer.initialize();

    // Create optimized database indexes
    await DatabaseOptimizer.createOptimizedIndexes();
    
    // Analyze table statistics for query optimization
    await DatabaseOptimizer.analyzeTableStatistics();

    // Initialize search service
    await SearchService.initialize();
    console.log('✅ Search service initialized');

    // Initialize moderation service
    const moderationService = await initializeModerationService(DatabaseConnection.getPool());
    console.log('✅ Moderation service initialized');

    // Create moderation routes with the initialized service
    const moderationRoutes = createModerationRoutes(moderationService.models);
    
    // Set up moderation routes
    app.use(`${API_PREFIX}/moderation`, moderationRoutes);

    // Initialize Redis connection (optional)
    try {
      await RedisConnection.initialize();
      console.log('✅ Redis connected successfully');
    } catch (error: unknown) {
      console.log('⚠️  Redis connection failed, continuing without Redis:', (error as Error).message);
    }

    // Initialize file storage
    await fileStorageService.initialize();
    console.log('✅ File storage initialized');

    // Register services with the gateway
    const baseUrl = `http://localhost:${PORT}${API_PREFIX}`;
    
    const services = [
      { name: 'auth', path: '/auth' },
      { name: 'content', path: '/content' },
      { name: 'social', path: '/social' },
      { name: 'profile', path: '/profile' },
      { name: 'blog', path: '/blog' },
      { name: 'notifications', path: '/notifications' },
      { name: 'search', path: '/search' },
      { name: 'moderation', path: '/moderation' }
    ];

    services.forEach(service => {
      serviceRegistry.register({
        name: service.name,
        path: service.path,
        target: `${baseUrl}${service.path}`,
        healthCheck: '/health',
        timeout: 30000,
        retries: 3
      });
    });

    console.log('✅ All services registered with gateway');

    // Start the server with HTTPS in production
    let server;
    const httpsOptions = SSLConfig.getHTTPSOptions();
    
    if (httpsOptions && config.isProduction()) {
      const https = require('https');
      server = https.createServer(httpsOptions, app).listen(PORT, config.get('server.host'), () => {
        console.log(`🔒 HTTPS Server running on port ${PORT}`);
        console.log(`🔗 API Base URL: https://localhost:${PORT}${API_PREFIX}`);
      });
    } else {
      server = app.listen(PORT, config.get('server.host'), () => {
        console.log(`🚀 HTTP Server running on port ${PORT}`);
        console.log(`🔗 API Base URL: http://localhost:${PORT}${API_PREFIX}`);
      });
    }

    console.log(`📈 Metrics available at: http://localhost:${PORT}/metrics`);
    console.log(`🏥 Health checks at: http://localhost:${PORT}/health`);

    // Initialize WebSocket server for real-time notifications
    notificationWebSocketService.initialize(server);

    // Start monitoring and cleanup tasks
    startBackgroundTasks();

    console.log('✅ All services started successfully');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Background tasks for maintenance and monitoring
function startBackgroundTasks() {
  // Clean up old metrics every hour
  setInterval(() => {
    monitoring.clearOldMetrics();
    QueryMonitor.clearStats();
  }, 60 * 60 * 1000);

  // Database maintenance every 6 hours
  setInterval(async () => {
    try {
      await DatabaseOptimizer.cleanupOldData();
      console.log('✅ Scheduled database cleanup completed');
    } catch (error) {
      console.error('❌ Scheduled database cleanup failed:', error);
    }
  }, 6 * 60 * 60 * 1000);

  // Performance monitoring every 5 minutes
  if (config.get('performance.enableMetrics')) {
    setInterval(() => {
      ConnectionPoolMonitor.logPoolStats();
      const queryStats = QueryMonitor.getQueryStats();
      
      if (queryStats.length > 0) {
        console.log('[PERFORMANCE] Top slow queries:', queryStats.slice(0, 3));
      }
    }, config.get('performance.metricsInterval'));
  }

  // Weekly database maintenance
  if (config.isProduction()) {
    setInterval(async () => {
      try {
        await DatabaseOptimizer.performMaintenance();
        console.log('✅ Weekly database maintenance completed');
      } catch (error) {
        console.error('❌ Weekly database maintenance failed:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  console.log('✅ Background monitoring and maintenance tasks started');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  notificationWebSocketService.close();
  await DatabaseConnection.close();
  await RedisConnection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  notificationWebSocketService.close();
  await DatabaseConnection.close();
  await RedisConnection.close();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

export default app;