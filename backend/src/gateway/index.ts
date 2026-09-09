import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { rateLimiter } from '../middleware/rateLimiter';
import { errorHandler } from '../middleware/errorHandler';

export interface ServiceConfig {
  name: string;
  path: string;
  target: string;
  healthCheck: string;
  timeout: number;
  retries: number;
}

export class APIGateway {
  private app: express.Application;
  private services: Map<string, ServiceConfig> = new Map();
  private healthStatus: Map<string, boolean> = new Map();

  constructor() {
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // Security and general middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[Gateway] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  public registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);
    this.healthStatus.set(config.name, false);

    // Create proxy middleware for the service
    const proxyOptions: Options = {
      target: config.target,
      changeOrigin: true,
      pathRewrite: {
        [`^${config.path}`]: ''
      },
      timeout: config.timeout,
      onError: (err, req, res) => {
        console.error(`[Gateway] Proxy error for ${config.name}:`, err.message);
        if (!res.headersSent) {
          res.status(503).json({
            error: 'Service Unavailable',
            message: `${config.name} service is currently unavailable`,
            timestamp: new Date().toISOString()
          });
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add service identification headers
        proxyReq.setHeader('X-Gateway-Service', config.name);
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add response headers
        proxyRes.headers['X-Gateway-Service'] = config.name;
        proxyRes.headers['X-Gateway-Response-Time'] = new Date().toISOString();
      }
    };

    // Register the proxy middleware
    this.app.use(config.path, createProxyMiddleware(proxyOptions));
    
    console.log(`[Gateway] Registered service: ${config.name} at ${config.path} -> ${config.target}`);
  }

  public setupHealthChecks(): void {
    // Gateway health check
    this.app.get('/health', (req: Request, res: Response) => {
      const services = Array.from(this.services.entries()).map(([name, config]) => ({
        name,
        status: this.healthStatus.get(name) ? 'healthy' : 'unhealthy',
        endpoint: config.healthCheck
      }));

      const allHealthy = Array.from(this.healthStatus.values()).every(status => status);

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services
      });
    });

    // Individual service health checks
    this.app.get('/health/:service', async (req: Request, res: Response) => {
      const serviceName = req.params.service;
      const service = this.services.get(serviceName);

      if (!service) {
        return res.status(404).json({
          error: 'Service not found',
          service: serviceName
        });
      }

      const isHealthy = await this.checkServiceHealth(service);
      res.status(isHealthy ? 200 : 503).json({
        service: serviceName,
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    });
  }

  private async checkServiceHealth(service: ServiceConfig): Promise<boolean> {
    try {
      const response = await fetch(`${service.target}${service.healthCheck}`, {
        method: 'GET',
        signal: typeof AbortSignal !== 'undefined' && (AbortSignal as any).timeout ? (AbortSignal as any).timeout(5000) : undefined
      });
      
      const isHealthy = response.ok;
      this.healthStatus.set(service.name, isHealthy);
      return isHealthy;
    } catch (error) {
      console.error(`[Gateway] Health check failed for ${service.name}:`, error);
      this.healthStatus.set(service.name, false);
      return false;
    }
  }

  public startHealthMonitoring(): void {
    // Check service health every 30 seconds
    setInterval(async () => {
      for (const [name, config] of this.services) {
        await this.checkServiceHealth(config);
      }
    }, 30000);

    console.log('[Gateway] Health monitoring started');
  }

  public setupErrorHandling(): void {
    // 404 handler for unmatched routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getServiceStatus(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }
}