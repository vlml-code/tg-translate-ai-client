/**
 * Database service for persistent storage of channels and messages using IndexedDB
 */

const DB_NAME = 'TelegramArchive';
const DB_VERSION = 1;

// Object store names
const STORES = {
  SAVED_CHANNELS: 'savedChannels',
  ARCHIVED_MESSAGES: 'archivedMessages',
};

export interface SavedChannel {
  id: string;
  title: string;
  isChecked: boolean;
  tag?: string;
  lastArchived?: Date;
}

export interface ArchivedMessage {
  id?: number; // Auto-increment key
  chatId: string;
  messageId: number;
  text: string;
  date: Date; // Original message date
  archivedDate: Date; // When it was archived
  senderId: string;
  senderName: string;
  isOutgoing: boolean;
}

class DatabaseService {
  private db: IDBDatabase | null = null;

  /**
   * Initialize and open the database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create savedChannels store
        if (!db.objectStoreNames.contains(STORES.SAVED_CHANNELS)) {
          const channelStore = db.createObjectStore(STORES.SAVED_CHANNELS, { keyPath: 'id' });
          channelStore.createIndex('isChecked', 'isChecked', { unique: false });
          channelStore.createIndex('tag', 'tag', { unique: false });
        }

        // Create archivedMessages store
        if (!db.objectStoreNames.contains(STORES.ARCHIVED_MESSAGES)) {
          const messageStore = db.createObjectStore(STORES.ARCHIVED_MESSAGES, {
            keyPath: 'id',
            autoIncrement: true
          });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
          messageStore.createIndex('date', 'date', { unique: false });
          messageStore.createIndex('chatId_date', ['chatId', 'date'], { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ========== Saved Channels Methods ==========

  /**
   * Save or update a channel's checked status
   */
  async saveChannel(channel: SavedChannel): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SAVED_CHANNELS], 'readwrite');
      const store = transaction.objectStore(STORES.SAVED_CHANNELS);
      const request = store.put(channel);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save channel'));
    });
  }

  /**
   * Get all saved channels
   */
  async getAllChannels(): Promise<SavedChannel[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SAVED_CHANNELS], 'readonly');
      const store = transaction.objectStore(STORES.SAVED_CHANNELS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get channels'));
    });
  }

  /**
   * Get checked channels only
   */
  async getCheckedChannels(): Promise<SavedChannel[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SAVED_CHANNELS], 'readonly');
      const store = transaction.objectStore(STORES.SAVED_CHANNELS);
      const request = store.getAll();

      request.onsuccess = () => {
        const allChannels = request.result as SavedChannel[];
        const checkedChannels = allChannels.filter(ch => ch.isChecked);
        resolve(checkedChannels);
      };
      request.onerror = () => reject(new Error('Failed to get checked channels'));
    });
  }

  /**
   * Get channels by tag
   */
  async getChannelsByTag(tag: string): Promise<SavedChannel[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SAVED_CHANNELS], 'readonly');
      const store = transaction.objectStore(STORES.SAVED_CHANNELS);
      const request = store.getAll();

      request.onsuccess = () => {
        const allChannels = request.result as SavedChannel[];
        const channelsByTag = allChannels.filter(ch => ch.tag === tag);
        resolve(channelsByTag);
      };
      request.onerror = () => reject(new Error('Failed to get channels by tag'));
    });
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SAVED_CHANNELS], 'readonly');
      const store = transaction.objectStore(STORES.SAVED_CHANNELS);
      const request = store.getAll();

      request.onsuccess = () => {
        const allChannels = request.result as SavedChannel[];
        const tags = new Set<string>();
        allChannels.forEach(ch => {
          if (ch.tag) {
            tags.add(ch.tag);
          }
        });
        resolve(Array.from(tags).sort());
      };
      request.onerror = () => reject(new Error('Failed to get tags'));
    });
  }

  /**
   * Update channel's last archived date
   */
  async updateChannelLastArchived(channelId: string, date: Date): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SAVED_CHANNELS], 'readwrite');
      const store = transaction.objectStore(STORES.SAVED_CHANNELS);
      const getRequest = store.get(channelId);

      getRequest.onsuccess = () => {
        const channel = getRequest.result;
        if (channel) {
          channel.lastArchived = date;
          const putRequest = store.put(channel);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error('Failed to update channel'));
        } else {
          resolve(); // Channel not found, just resolve
        }
      };

      getRequest.onerror = () => reject(new Error('Failed to get channel'));
    });
  }

  // ========== Archived Messages Methods ==========

  /**
   * Save multiple messages
   */
  async saveMessages(messages: ArchivedMessage[]): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ARCHIVED_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.ARCHIVED_MESSAGES);

      let completed = 0;
      let hasError = false;

      messages.forEach((message) => {
        const request = store.add(message);

        request.onsuccess = () => {
          completed++;
          if (completed === messages.length && !hasError) {
            resolve();
          }
        };

        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(new Error('Failed to save message'));
          }
        };
      });

      if (messages.length === 0) {
        resolve();
      }
    });
  }

  /**
   * Get messages for a specific date (all channels)
   */
  async getMessagesByDate(date: Date): Promise<ArchivedMessage[]> {
    const db = await this.ensureDb();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ARCHIVED_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.ARCHIVED_MESSAGES);
      const index = store.index('date');
      const range = IDBKeyRange.bound(startOfDay, endOfDay);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get messages'));
    });
  }

  /**
   * Get messages for a specific channel and date
   */
  async getMessagesByChatAndDate(chatId: string, date: Date): Promise<ArchivedMessage[]> {
    const db = await this.ensureDb();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ARCHIVED_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.ARCHIVED_MESSAGES);
      const index = store.index('chatId_date');
      const request = index.openCursor();

      const results: ArchivedMessage[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const message = cursor.value as ArchivedMessage;
          if (message.chatId === chatId &&
              message.date >= startOfDay &&
              message.date <= endOfDay) {
            results.push(message);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(new Error('Failed to get messages'));
    });
  }

  /**
   * Get all unique dates that have archived messages
   */
  async getArchivedDates(): Promise<Date[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ARCHIVED_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.ARCHIVED_MESSAGES);
      const index = store.index('date');
      const request = index.openCursor();

      const dates = new Set<string>();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const message = cursor.value as ArchivedMessage;
          const dateStr = new Date(message.date).toDateString();
          dates.add(dateStr);
          cursor.continue();
        } else {
          const uniqueDates = Array.from(dates).map(d => new Date(d));
          uniqueDates.sort((a, b) => b.getTime() - a.getTime());
          resolve(uniqueDates);
        }
      };

      request.onerror = () => reject(new Error('Failed to get archived dates'));
    });
  }

  /**
   * Clear all archived messages (for cleanup)
   */
  async clearArchivedMessages(): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ARCHIVED_MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.ARCHIVED_MESSAGES);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear messages'));
    });
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
