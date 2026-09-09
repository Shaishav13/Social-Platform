import { createClient, RedisClientType } from 'redis';

export class RedisConnection {
  private static client: RedisClientType;

  static async initialize(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });

    await this.client.connect();
  }

  static getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.client;
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  static async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (expireInSeconds) {
      await client.setEx(key, expireInSeconds, value);
    } else {
      await client.set(key, value);
    }
  }

  static async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return client.get(key);
  }

  static async del(key: string): Promise<void> {
    const client = this.getClient();
    await client.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    const result = await client.exists(key);
    return result === 1;
  }
}