export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: Date | null;
  created_at: Date;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}

// Websocket Events
export enum ChatEvent {
  SEND_MESSAGE = 'SEND_MESSAGE',
  RECEIVE_MESSAGE = 'RECEIVE_MESSAGE',
  TYPING = 'TYPING',
  READ_RECEIPT = 'READ_RECEIPT',
  USER_ONLINE = 'USER_ONLINE',
  USER_OFFLINE = 'USER_OFFLINE',
  ERROR = 'ERROR'
}
