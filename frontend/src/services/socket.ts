export const ChatEvent = {
  SEND_MESSAGE: 'SEND_MESSAGE',
  RECEIVE_MESSAGE: 'RECEIVE_MESSAGE',
  TYPING: 'TYPING',
  READ_RECEIPT: 'READ_RECEIPT',
  USER_ONLINE: 'USER_ONLINE',
  USER_OFFLINE: 'USER_OFFLINE',
  ERROR: 'ERROR'
} as const;

type MessageHandler = (data: any) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isIntentionalDisconnect = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;
    
    this.isIntentionalDisconnect = false;
    
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Use ws:// or wss:// based on current protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // For local dev, api url might be localhost:3003
    const apiHost = import.meta.env.VITE_API_URL 
      ? new URL(import.meta.env.VITE_API_URL).host 
      : 'localhost:3003';
      
    this.ws = new WebSocket(`${protocol}//${apiHost}/ws/chat?token=${token}`);

    this.ws.onopen = () => {
      console.log('Connected to chat server');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;
        
        if (this.handlers.has(type)) {
          this.handlers.get(type)!.forEach(handler => handler(payload));
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from chat server');
      this.ws = null;
      
      if (!this.isIntentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }
    };
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.ws) {
      if (this.ws.readyState === WebSocket.CONNECTING) {
        const wsToClose = this.ws;
        wsToClose.onopen = () => wsToClose.close();
      } else {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: MessageHandler) {
    if (this.handlers.has(event)) {
      this.handlers.get(event)!.delete(handler);
    }
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }
}

export const socketService = new SocketService();
