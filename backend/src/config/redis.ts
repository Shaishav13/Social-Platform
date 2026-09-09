import { createClient, RedisClientType } from 'redis';

export class RedisConnection {
  private static client: RedisClientType | null = null;
  private static connected = false;

  static isConnected(): boolean {
    return this.connected && !!this.client && this.client.isOpen;
  }

  static async initialize(): Promise<void> {
    if (this.client && this.connected) {
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    const password = process.env.REDIS_PASSWORD;
    const hasPassword = Boolean(password && password.trim() !== '' && password !== 'secure_redis_password');

    const clientOptions: any = redisUrl
      ? {
          url: redisUrl,
          socket: redisUrl.startsWith('rediss://') ? { tls: true, rejectUnauthorized: false } : undefined,
        }
      : {
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            reconnectStrategy: (retries: number) => {
              if (retries > 2) {
                return false; // Stop reconnecting after 2 retries
              }
              return 300;
            },
          },
          ...(hasPassword && { password }),
        };

    const newClient = createClient(clientOptions) as RedisClientType;

    newClient.on('error', (err) => {
      if (this.connected) {
        console.warn('⚠️ Redis Client Error:', err.message);
      }
    });

    try {
      await newClient.connect();
      this.client = newClient;
      this.connected = true;
    } catch (err: any) {
      this.connected = false;
      try {
        await newClient.disconnect();
      } catch {}
      this.client = null;
      throw new Error(`Redis connection failed: ${err.message}`);
    }
  }

  static getClient(): RedisClientType {
    if (!this.client || !this.connected) {
      throw new Error('Redis not connected.');
    }
    return this.client;
  }

  static async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {}
      this.client = null;
      this.connected = false;
    }
  }

  static async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    if (!this.isConnected() || !this.client) return;
    try {
      if (expireInSeconds) {
        await this.client.setEx(key, expireInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch {}
  }

  static async get(key: string): Promise<string | null> {
    if (!this.isConnected() || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  static async del(key: string): Promise<void> {
    if (!this.isConnected() || !this.client) return;
    try {
      await this.client.del(key);
    } catch {}
  }

  static async exists(key: string): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }
}