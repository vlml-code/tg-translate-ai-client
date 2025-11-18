import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { computeCheck } from 'telegram/Password';
import { SessionManager } from './sessionManager';
import { ChatInfo, MessageInfo } from '../types';

// You need to get these from https://my.telegram.org/apps
const API_ID = parseInt(import.meta.env.VITE_API_ID || '0');
const API_HASH = import.meta.env.VITE_API_HASH || '';

export class TelegramService {
  private client: TelegramClient | null = null;
  private phoneCodeHash: string = '';

  async initialize(): Promise<void> {
    const savedSession = SessionManager.getSession();
    this.client = this.createClient(savedSession?.session || '');

    try {
      await this.client.connect();
    } catch (error: any) {
      if (this.isAuthKeyDuplicated(error)) {
        console.warn('Detected duplicated auth key, clearing cached session.');
        SessionManager.clearSession();
        this.client = this.createClient('');
        await this.client.connect();
        throw new Error('AUTH_KEY_DUPLICATED');
      }
      throw error;
    }
  }

  async isAuthorized(): Promise<boolean> {
    if (!this.client) return false;
    return await this.client.isUserAuthorized();
  }

  async sendCode(phoneNumber: string): Promise<string> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.sendCode(
      {
        apiId: API_ID,
        apiHash: API_HASH,
      },
      phoneNumber
    );

    this.phoneCodeHash = result.phoneCodeHash;
    return result.phoneCodeHash;
  }

  async signIn(phoneNumber: string, code: string): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: this.phoneCodeHash,
          phoneCode: code,
        })
      );

      // Save session
      const session = this.client.session.save() as unknown as string;
      SessionManager.saveSession(session, phoneNumber);
    } catch (error: any) {
      // If 2FA is enabled, this will throw SESSION_PASSWORD_NEEDED
      if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw error;
    }
  }

  async signInWithPassword(password: string): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    // Get password information from Telegram
    const passwordInfo = await this.client.invoke(
      new Api.account.GetPassword()
    );

    // Compute the password check
    const passwordCheck = await computeCheck(passwordInfo, password);

    // Sign in with the password
    await this.client.invoke(
      new Api.auth.CheckPassword({
        password: passwordCheck,
      })
    );

    // Save session
    const session = this.client.session.save() as unknown as string;
    const savedSession = SessionManager.getSession();
    if (savedSession) {
      SessionManager.saveSession(session, savedSession.phoneNumber);
    }
  }

  async getChats(): Promise<ChatInfo[]> {
    if (!this.client) throw new Error('Client not initialized');

    const dialogs = await this.client.getDialogs({ limit: 100 });
    const chats: ChatInfo[] = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;
      let title = '';
      let isChannel = false;
      let isGroup = false;

      if (entity instanceof Api.User) {
        title = entity.firstName || '';
        if (entity.lastName) title += ` ${entity.lastName}`;
      } else if (entity instanceof Api.Chat) {
        title = entity.title;
        isGroup = true;
      } else if (entity instanceof Api.Channel) {
        title = entity.title;
        isChannel = entity.broadcast || false;
        isGroup = entity.megagroup || false;
      }

      chats.push({
        id: dialog.id?.toString() || '',
        title: title || 'Unknown',
        lastMessage: dialog.message?.message || '',
        lastMessageDate: dialog.message?.date ? new Date(dialog.message.date * 1000) : undefined,
        unreadCount: dialog.unreadCount || 0,
        isChannel,
        isGroup,
      });
    }

    return chats;
  }

  async getMessages(chatId: string, limit: number = 50, offsetId: number = 0): Promise<MessageInfo[]> {
    if (!this.client) throw new Error('Client not initialized');

    const messages = await this.client.getMessages(chatId, {
      limit,
      offsetId,
    });

    const result: MessageInfo[] = [];

    for (const msg of messages) {
      if (msg instanceof Api.Message) {
        let senderName = 'Unknown';

        if (msg.fromId) {
          try {
            const sender = await this.client.getEntity(msg.fromId);
            if (sender instanceof Api.User) {
              senderName = sender.firstName || '';
              if (sender.lastName) senderName += ` ${sender.lastName}`;
            } else if (sender instanceof Api.Channel || sender instanceof Api.Chat) {
              senderName = (sender as any).title || 'Channel';
            }
          } catch (error) {
            console.error('Failed to get sender:', error);
          }
        }

        result.push({
          id: msg.id,
          text: msg.message || '',
          date: new Date(msg.date * 1000),
          senderId: msg.fromId?.toString() || '',
          senderName,
          isOutgoing: msg.out || false,
          media: msg.media,
        });
      }
    }

    return result;
  }

  async logout(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.invoke(new Api.auth.LogOut());
    } catch (error) {
      console.error('Logout error:', error);
    }

    SessionManager.clearSession();
    this.client = null;
  }

  /**
   * Check if user can post messages to a channel/group
   */
  async canPostToChannel(chatId: string): Promise<boolean> {
    if (!this.client) throw new Error('Client not initialized');

    try {
      const entity = await this.client.getEntity(chatId);

      if (entity instanceof Api.Channel) {
        // Check if we have posting rights
        // For channels: need to be creator or admin with post_messages right
        // For megagroups: check if not restricted
        if (entity.broadcast) {
          // It's a channel (not a supergroup)
          return entity.creator || (entity.adminRights?.postMessages || false);
        } else {
          // It's a supergroup/megagroup - check if we can send messages
          return !entity.banned;
        }
      } else if (entity instanceof Api.Chat) {
        // Regular group - check if we're not restricted
        return true; // Regular groups usually allow all members to post
      }

      return false;
    } catch (error) {
      console.error(`Failed to check posting rights for ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Get channels/groups where user can post
   */
  async getPostableChats(): Promise<ChatInfo[]> {
    const allChats = await this.getChats();
    const postableChats: ChatInfo[] = [];

    for (const chat of allChats) {
      // Only check channels and groups
      if (chat.isChannel || chat.isGroup) {
        const canPost = await this.canPostToChannel(chat.id);
        if (canPost) {
          postableChats.push(chat);
        }
      }
    }

    return postableChats;
  }

  /**
   * Send a message to a channel/chat
   */
  async sendMessage(chatId: string, message: string): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    try {
      await this.client.sendMessage(chatId, {
        message,
        parseMode: 'md', // Use Markdown parsing
      });
    } catch (error) {
      console.error(`Failed to send message to ${chatId}:`, error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send multiple messages to a channel/chat (for long content)
   */
  async sendMessages(chatId: string, messages: string[]): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    for (let i = 0; i < messages.length; i++) {
      try {
        await this.sendMessage(chatId, messages[i]);
        // Add a small delay between messages to avoid rate limiting
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        throw new Error(`Failed to send message ${i + 1}/${messages.length}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  getClient(): TelegramClient | null {
    return this.client;
  }

  private createClient(session: string): TelegramClient {
    const stringSession = new StringSession(session);
    return new TelegramClient(stringSession, API_ID, API_HASH, {
      connectionRetries: 5,
    });
  }

  private isAuthKeyDuplicated(error: any): boolean {
    const message = error?.message || '';
    return message.includes('AUTH_KEY_DUPLICATED');
  }
}

export const telegramService = new TelegramService();
