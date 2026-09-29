import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage, Server } from 'http';
import jwt from 'jsonwebtoken';
import { ChatDatabase } from './database';
import { ChatEvent } from './types';
import { EmailService } from '../auth/emailService';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class ChatWebSocketService {
  private wss!: WebSocketServer;
  private db: ChatDatabase;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor() {
    this.db = new ChatDatabase();
  }

  initialize() {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Heartbeat
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const extWs = ws as AuthenticatedWebSocket;
        if (extWs.isAlive === false) return ws.terminate();
        
        extWs.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleUpgrade(request: any, socket: any, head: any): void {
    if (!this.wss) return;
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  private handleConnection(ws: AuthenticatedWebSocket, request: IncomingMessage) {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const url = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      ws.userId = decoded.userId;

      if (!this.clients.has(ws.userId)) {
        this.clients.set(ws.userId, new Set());
      }
      this.clients.get(ws.userId)!.add(ws);
      
      this.broadcastToOthers(ws.userId, ChatEvent.USER_ONLINE, { userId: ws.userId });

      ws.on('message', (message: string) => this.handleMessage(ws, message));
      ws.on('close', () => this.handleDisconnect(ws));

    } catch (error) {
      ws.close(1008, 'Invalid token');
    }
  }

  private async handleMessage(ws: AuthenticatedWebSocket, rawMessage: string) {
    if (!ws.userId) return;

    try {
      const data = JSON.parse(rawMessage);
      
      switch (data.type) {
        case ChatEvent.SEND_MESSAGE:
          const { conversationId, content, receiverId } = data.payload;
          try {
            const { message: savedMessage, receiverEmail, receiverSentCount } = await this.db.saveMessage(conversationId, ws.userId, content);
            
            ws.send(JSON.stringify({
              type: ChatEvent.RECEIVE_MESSAGE,
              payload: savedMessage
            }));

            if (receiverId && this.clients.has(receiverId)) {
              this.clients.get(receiverId)!.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: ChatEvent.RECEIVE_MESSAGE,
                    payload: savedMessage
                  }));
                }
              });
            }
            
            if (receiverSentCount > 0 && receiverEmail) {
              EmailService.sendChatMessageEmail(receiverEmail).catch(e => console.error('[EMAIL] error', e));
            }
          } catch (err: any) {
            if (err.message === 'LIMIT_REACHED') {
              ws.send(JSON.stringify({
                type: ChatEvent.ERROR,
                payload: { message: "You can only send one message to users who don't follow you back." }
              }));
            } else {
              console.error('Failed to save message:', err);
            }
          }
          break;
          
        case ChatEvent.TYPING:
        case ChatEvent.READ_RECEIPT:
          if (data.payload.receiverId && this.clients.has(data.payload.receiverId)) {
             this.clients.get(data.payload.receiverId)!.forEach(client => {
               if (client.readyState === WebSocket.OPEN) {
                 client.send(JSON.stringify({
                   type: data.type,
                   payload: { ...data.payload, userId: ws.userId }
                 }));
               }
             });
          }
          break;
      }
    } catch (e) {
      console.error('Error handling WS message:', e);
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (ws.userId && this.clients.has(ws.userId)) {
      const userClients = this.clients.get(ws.userId)!;
      userClients.delete(ws);
      
      if (userClients.size === 0) {
        this.clients.delete(ws.userId);
        this.broadcastToOthers(ws.userId, ChatEvent.USER_OFFLINE, { userId: ws.userId });
      }
    }
  }

  private broadcastToOthers(excludeUserId: string, event: ChatEvent, payload: any) {
     this.clients.forEach((clients, userId) => {
        if (userId !== excludeUserId) {
           clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                 client.send(JSON.stringify({ type: event, payload }));
              }
           });
        }
     });
  }

  close() {
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const chatWebSocketService = new ChatWebSocketService();
