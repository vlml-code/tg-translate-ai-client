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

export interface TranslationSettings {
  apiKey: string;
  prompt: string;
  simplifyPrompt: string;
  segmentPrompt: string;
  deepseekApiKey: string;
  digestPrompt: string;
  digestTargetChannelId: string;
}

// Dictionary entry for a Chinese word with multiple possible meanings
export interface DictionaryEntry {
  word: string;           // Chinese characters
  pinyin: string;         // Pinyin with tone marks
  meanings: string[];     // Multiple English translations
  addedAt: number;        // Timestamp when first added
  usageCount: number;     // How many times this word was encountered
}

// AI segmentation result for a single word/segment
export interface SegmentResult {
  word: string;           // Chinese characters
  pinyin: string;         // Pinyin with tone marks
  translation: string;    // English translation
}

// AI response format for segmentation
export interface AISegmentationResponse {
  segments: SegmentResult[];
}

export type TelegramMessage = Api.Message;
export type TelegramChat = Api.Chat | Api.Channel | Api.User;
