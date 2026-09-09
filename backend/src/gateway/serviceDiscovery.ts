import { ServiceConfig } from './index';

export interface ServiceRegistry {
  register(service: ServiceConfig): void;
  unregister(serviceName: string): void;
  discover(serviceName: string): ServiceConfig | null;
  getAllServices(): ServiceConfig[];
  getHealthyServices(): ServiceConfig[];
}

export class InMemoryServiceRegistry implements ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private healthStatus: Map<string, boolean> = new Map();

  register(service: ServiceConfig): void {
    this.services.set(service.name, service);
    this.healthStatus.set(service.name, true);
    console.log(`[ServiceRegistry] Registered service: ${service.name}`);
  }

  unregister(serviceName: string): void {
    this.services.delete(serviceName);
    this.healthStatus.delete(serviceName);
    console.log(`[ServiceRegistry] Unregistered service: ${serviceName}`);
  }

  discover(serviceName: string): ServiceConfig | null {
    return this.services.get(serviceName) || null;
  }

  getAllServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  getHealthyServices(): ServiceConfig[] {
    return Array.from(this.services.values()).filter(service => 
      this.healthStatus.get(service.name) === true
    );
  }

  updateHealthStatus(serviceName: string, isHealthy: boolean): void {
    if (this.services.has(serviceName)) {
      this.healthStatus.set(serviceName, isHealthy);
    }
  }

  getHealthStatus(serviceName: string): boolean {
    return this.healthStatus.get(serviceName) || false;
  }
}

export class LoadBalancer {
  private currentIndex: Map<string, number> = new Map();

  // Round-robin load balancing
  selectService(services: ServiceConfig[]): ServiceConfig | null {
    if (services.length === 0) return null;
    if (services.length === 1) return services[0];

    const serviceKey = services.map(s => s.name).join(',');
    const currentIdx = this.currentIndex.get(serviceKey) || 0;
    const selectedService = services[currentIdx];
    
    this.currentIndex.set(serviceKey, (currentIdx + 1) % services.length);
    return selectedService;
  }

  // Health-aware service selection
  selectHealthyService(services: ServiceConfig[], registry: InMemoryServiceRegistry): ServiceConfig | null {
    const healthyServices = services.filter(service => 
      registry.getHealthStatus(service.name)
    );
    
    return this.selectService(healthyServices);
  }
}

// Circuit breaker pattern for service resilience
export class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();
  private state: Map<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'> = new Map();

  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 1 minute
  private readonly retryTimeout = 30000; // 30 seconds

  async execute<T>(serviceName: string, operation: () => Promise<T>): Promise<T> {
    const currentState = this.getState(serviceName);

    if (currentState === 'OPEN') {
      if (this.shouldAttemptReset(serviceName)) {
        this.state.set(serviceName, 'HALF_OPEN');
      } else {
        throw new Error(`Circuit breaker is OPEN for service: ${serviceName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(serviceName);
      return result;
    } catch (error) {
      this.onFailure(serviceName);
      throw error;
    }
  }

  private getState(serviceName: string): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state.get(serviceName) || 'CLOSED';
  }

  private shouldAttemptReset(serviceName: string): boolean {
    const lastFailure = this.lastFailureTime.get(serviceName) || 0;
    return Date.now() - lastFailure > this.retryTimeout;
  }

  private onSuccess(serviceName: string): void {
    this.failures.set(serviceName, 0);
    this.state.set(serviceName, 'CLOSED');
  }

  private onFailure(serviceName: string): void {
    const currentFailures = this.failures.get(serviceName) || 0;
    const newFailures = currentFailures + 1;
    
    this.failures.set(serviceName, newFailures);
    this.lastFailureTime.set(serviceName, Date.now());

    if (newFailures >= this.failureThreshold) {
      this.state.set(serviceName, 'OPEN');
      console.warn(`[CircuitBreaker] Circuit breaker OPEN for service: ${serviceName}`);
    }
  }

  getServiceState(serviceName: string): { state: string; failures: number } {
    return {
      state: this.getState(serviceName),
      failures: this.failures.get(serviceName) || 0
    };
  }
}