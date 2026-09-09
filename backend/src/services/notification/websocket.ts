import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { Notification } from './types';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class NotificationWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/notifications/live'
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      this.handleConnection(ws, request);
    });

    // Set up heartbeat to detect broken connections
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000); // 30 seconds

    console.log('✅ WebSocket server initialized for notifications');
  }

  private handleConnection(ws: AuthenticatedWebSocket, request: any): void {
    ws.isAlive = true;

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle authentication
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'auth' && data.token) {
          this.authenticateClient(ws, data.token);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
        ws.close(1003, 'Invalid message format');
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(ws);
    });

    // Send authentication request
    ws.send(JSON.stringify({
      type: 'auth_required',
      message: 'Please send authentication token'
    }));
  }

  private authenticateClient(ws: AuthenticatedWebSocket, token: string): void {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret || secret.trim() === '' || secret === 'your-secret-key') {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be configured with a strong secret in production.');
        }
      }
      const JWT_SECRET = secret || 'udtabirdie_dev_super_secret_jwt_key_at_least_32_chars!';
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
      
      if (decoded && decoded.userId) {
        ws.userId = decoded.userId;
        
        // Add client to user's connection set
        if (!this.clients.has(decoded.userId)) {
          this.clients.set(decoded.userId, new Set());
        }
        this.clients.get(decoded.userId)!.add(ws);

        // Send authentication success
        ws.send(JSON.stringify({
          type: 'auth_success',
          message: 'Authentication successful'
        }));

        console.log(`WebSocket client authenticated: ${decoded.userId}`);
      } else {
        ws.close(1008, 'Invalid token');
      }
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      const userConnections = this.clients.get(ws.userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
      console.log(`WebSocket client disconnected: ${ws.userId}`);
    }
  }

  private heartbeat(): void {
    if (!this.wss) return;

    this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        this.handleDisconnection(ws);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }

  // Send notification to specific user
  sendNotificationToUser(userId: string, notification: Notification): void {
    const userConnections = this.clients.get(userId);
    
    if (userConnections && userConnections.size > 0) {
      const message = JSON.stringify({
        type: 'notification',
        data: notification
      });

      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });

      console.log(`Notification sent to user ${userId} via WebSocket`);
    }
  }

  // Send notification to multiple users
  sendNotificationToUsers(userIds: string[], notification: Notification): void {
    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  // Broadcast notification to all connected users
  broadcastNotification(notification: Notification): void {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.readyState === WebSocket.OPEN && ws.userId) {
        ws.send(message);
      }
    });

    console.log('Notification broadcasted to all connected users');
  }

  // Send unread count update to user
  sendUnreadCountUpdate(userId: string, unreadCount: number): void {
    const userConnections = this.clients.get(userId);
    
    if (userConnections && userConnections.size > 0) {
      const message = JSON.stringify({
        type: 'unread_count',
        data: { unreadCount }
      });

      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  // Get connected user count
  getConnectedUserCount(): number {
    return this.clients.size;
  }

  // Get total connection count
  getTotalConnectionCount(): number {
    let totalConnections = 0;
    this.clients.forEach((connections) => {
      totalConnections += connections.size;
    });
    return totalConnections;
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    const userConnections = this.clients.get(userId);
    return userConnections ? userConnections.size > 0 : false;
  }

  // Close all connections and cleanup
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
      });
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    console.log('WebSocket server closed');
  }
}

// Singleton instance
export const notificationWebSocketService = new NotificationWebSocketService();