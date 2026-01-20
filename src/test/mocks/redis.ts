// Mock Redis for testing
export class MockRedisConnection {
  private static data: Map<string, string> = new Map();
  private static sets: Map<string, Set<string>> = new Map();

  static reset(): void {
    this.data.clear();
    this.sets.clear();
  }

  static async initialize(): Promise<void> {
    // No-op for mock
  }

  static getClient() {
    return {
      flushDb: async () => {
        MockRedisConnection.reset();
      },
      sAdd: async (key: string, value: string) => {
        if (!this.sets.has(key)) {
          this.sets.set(key, new Set());
        }
        this.sets.get(key)!.add(value);
      },
      sRem: async (key: string, value: string) => {
        const set = this.sets.get(key);
        if (set) {
          set.delete(value);
        }
      },
      sMembers: async (key: string) => {
        const set = this.sets.get(key);
        return set ? Array.from(set) : [];
      },
      expire: async (key: string, seconds: number) => {
        // No-op for mock
      },
    };
  }

  static async close(): Promise<void> {
    // No-op for mock
  }

  static async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
    this.data.set(key, value);
  }

  static async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  static async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  static async exists(key: string): Promise<boolean> {
    return this.data.has(key);
  }
}