import { Api } from 'telegram';

export interface SessionData {
  session: string;
  phoneNumber: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  phoneNumber: string | null;
  userId: string | null;
}

export interface ChatInfo {
  id: string;
  title: string;
  lastMessage?: string;
  lastMessageDate?: Date;
  unreadCount: number;
  isChannel: boolean;
  isGroup: boolean;
  photo?: string;
}

export interface MessageInfo {
  id: number;
  text: string;
  date: Date;
  senderId: string;
  senderName: string;
  isOutgoing: boolean;
  media?: any;
}

export interface AuthStep {
  type: 'phone' | 'code' | 'password' | 'authenticated';
  phoneCodeHash?: string;
}

export type TelegramMessage = Api.Message;
export type TelegramChat = Api.Chat | Api.Channel | Api.User;
