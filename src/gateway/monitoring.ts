import { Request, Response, NextFunction } from 'express';

export interface RequestMetrics {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  service?: string;
  userAgent?: string;
  ip: string;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: number;
  errorRate: number;
}

export class MonitoringService {
  private metrics: Map<string, ServiceMetrics> = new Map();
  private requestHistory: RequestMetrics[] = [];
  private readonly maxHistorySize = 10000;

  // Middleware to track request metrics
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Capture original end method
      const originalEnd = res.end;
      
      res.end = function(chunk?: any, encoding?: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Record metrics
        const requestMetric: RequestMetrics = {
          timestamp: startTime,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          service: req.headers['x-gateway-service'] as string,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress || 'unknown'
        };
        
        this.recordRequest(requestMetric);
        
        // Call original end method
        originalEnd.call(this, chunk, encoding);
      }.bind(this);
      
      next();
    };
  }

  private recordRequest(metric: RequestMetrics): void {
    // Add to history
    this.requestHistory.push(metric);
    
    // Maintain history size limit
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }

    // Update service metrics
    if (metric.service) {
      this.updateServiceMetrics(metric.service, metric);
    }
  }

  private updateServiceMetrics(serviceName: string, metric: RequestMetrics): void {
    const existing = this.metrics.get(serviceName) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: 0,
      errorRate: 0
    };

    const isSuccess = metric.statusCode >= 200 && metric.statusCode < 400;
    
    const updated: ServiceMetrics = {
      totalRequests: existing.totalRequests + 1,
      successfulRequests: existing.successfulRequests + (isSuccess ? 1 : 0),
      failedRequests: existing.failedRequests + (isSuccess ? 0 : 1),
      averageResponseTime: this.calculateNewAverage(
        existing.averageResponseTime,
        existing.totalRequests,
        metric.responseTime
      ),
      lastRequestTime: metric.timestamp,
      errorRate: 0 // Will be calculated below
    };

    updated.errorRate = (updated.failedRequests / updated.totalRequests) * 100;
    
    this.metrics.set(serviceName, updated);
  }

  private calculateNewAverage(currentAvg: number, count: number, newValue: number): number {
    return ((currentAvg * count) + newValue) / (count + 1);
  }

  // Get metrics for a specific service
  getServiceMetrics(serviceName: string): ServiceMetrics | null {
    return this.metrics.get(serviceName) || null;
  }

  // Get all service metrics
  getAllMetrics(): Map<string, ServiceMetrics> {
    return new Map(this.metrics);
  }

  // Get recent request history
  getRecentRequests(limit: number = 100): RequestMetrics[] {
    return this.requestHistory.slice(-limit);
  }

  // Get requests for a specific service
  getServiceRequests(serviceName: string, limit: number = 100): RequestMetrics[] {
    return this.requestHistory
      .filter(req => req.service === serviceName)
      .slice(-limit);
  }

  // Get error requests
  getErrorRequests(limit: number = 100): RequestMetrics[] {
    return this.requestHistory
      .filter(req => req.statusCode >= 400)
      .slice(-limit);
  }

  // Get performance summary
  getPerformanceSummary(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topServices: Array<{ name: string; requests: number }>;
  } {
    const totalRequests = this.requestHistory.length;
    const averageResponseTime = totalRequests > 0 
      ? this.requestHistory.reduce((sum, req) => sum + req.responseTime, 0) / totalRequests 
      : 0;
    
    const errorCount = this.requestHistory.filter(req => req.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const serviceCounts = new Map<string, number>();
    this.requestHistory.forEach(req => {
      if (req.service) {
        serviceCounts.set(req.service, (serviceCounts.get(req.service) || 0) + 1);
      }
    });

    const topServices = Array.from(serviceCounts.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      topServices
    };
  }

  // Alert system for monitoring thresholds
  checkAlerts(): Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> {
    const alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> = [];
    
    // Check error rates
    for (const [serviceName, metrics] of this.metrics) {
      if (metrics.errorRate > 50) {
        alerts.push({
          type: 'high_error_rate',
          message: `Service ${serviceName} has error rate of ${metrics.errorRate.toFixed(2)}%`,
          severity: 'high'
        });
      } else if (metrics.errorRate > 20) {
        alerts.push({
          type: 'elevated_error_rate',
          message: `Service ${serviceName} has elevated error rate of ${metrics.errorRate.toFixed(2)}%`,
          severity: 'medium'
        });
      }

      // Check response times
      if (metrics.averageResponseTime > 5000) {
        alerts.push({
          type: 'slow_response',
          message: `Service ${serviceName} has slow average response time: ${metrics.averageResponseTime.toFixed(0)}ms`,
          severity: 'medium'
        });
      }

      // Check if service hasn't received requests recently (potential downtime)
      const timeSinceLastRequest = Date.now() - metrics.lastRequestTime;
      if (timeSinceLastRequest > 300000) { // 5 minutes
        alerts.push({
          type: 'no_recent_requests',
          message: `Service ${serviceName} hasn't received requests for ${Math.round(timeSinceLastRequest / 60000)} minutes`,
          severity: 'low'
        });
      }
    }

    return alerts;
  }

  // Clear old metrics (for memory management)
  clearOldMetrics(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - olderThanMs;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoffTime);
  }
}