import { User, Session } from '../../services/auth/types';

// Mock database for testing
export class MockAuthDatabase {
  private static users: Map<string, User> = new Map();
  private static sessions: Map<string, Session> = new Map();
  private static usersByEmail: Map<string, User> = new Map();
  private static usersByUsername: Map<string, User> = new Map();

  static reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
  }

  static async createTables(): Promise<void> {
    // No-op for mock
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email) || null;
  }

  static async findUserByUsername(username: string): Promise<User | null> {
    return this.usersByUsername.get(username) || null;
  }

  static async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const user: User = {
      id,
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      profilePicture: userData.profilePicture,
      bio: userData.bio,
      isPrivate: userData.isPrivate,
      role: userData.role || 'user',
      isRestricted: userData.isRestricted || false,
      isVerified: userData.isVerified ?? true,
      emailVerifiedAt: userData.emailVerifiedAt || now,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, user);
    this.usersByEmail.set(userData.email, user);
    this.usersByUsername.set(userData.username, user);

    return user;
  }

  static async createSession(userId: string, refreshToken: string, expiresAt: Date): Promise<Session> {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const session: Session = {
      id,
      userId,
      refreshToken,
      expiresAt,
      createdAt: now,
      isActive: true,
    };

    this.sessions.set(refreshToken, session);
    return session;
  }

  static async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const session = this.sessions.get(refreshToken);
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }
    return session;
  }

  static async invalidateSession(refreshToken: string): Promise<void> {
    const session = this.sessions.get(refreshToken);
    if (session) {
      session.isActive = false;
    }
  }

  static async invalidateAllUserSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.isActive = false;
      }
    }
  }

  static async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [token, session] of this.sessions.entries()) {
      if (!session.isActive || session.expiresAt < now) {
        this.sessions.delete(token);
      }
    }
  }

  static async updateUser(userId: string, updateData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'passwordHash'>>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    // Remove old entries from lookup maps if username or email is changing
    if (updateData.username && updateData.username !== user.username) {
      this.usersByUsername.delete(user.username);
    }
    if (updateData.email && updateData.email !== user.email) {
      this.usersByEmail.delete(user.email);
    }

    // Update user data
    const updatedUser: User = {
      ...user,
      ...updateData,
      updatedAt: new Date(),
    };

    // Update all maps
    this.users.set(userId, updatedUser);
    this.usersByEmail.set(updatedUser.email, updatedUser);
    this.usersByUsername.set(updatedUser.username, updatedUser);

    return updatedUser;
  }

  static async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      this.usersByEmail.delete(user.email);
      this.usersByUsername.delete(user.username);
    }
  }
}

// Mock ContentDatabase for testing
export class MockContentDatabase {
  private static postCounts: Map<string, number> = new Map();

  static reset(): void {
    this.postCounts.clear();
  }

  static async getUserPostCount(userId: string): Promise<number> {
    return this.postCounts.get(userId) || 0;
  }

  static setUserPostCount(userId: string, count: number): void {
    this.postCounts.set(userId, count);
  }
}