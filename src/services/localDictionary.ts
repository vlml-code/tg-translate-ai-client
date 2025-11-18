import { DictionaryEntry } from '../types';

const DICTIONARY_KEY = 'chinese_dictionary';

/**
 * Local dictionary service using localStorage
 * Stores learned Chinese words with their meanings
 */
class LocalDictionary {
  private cache: Map<string, DictionaryEntry> | null = null;

  /**
   * Initialize SRS fields for entries that don't have them (migration)
   */
  private initializeSRSFields(entry: any): DictionaryEntry {
    const now = Date.now();
    return {
      ...entry,
      // Initialize SRS fields if they don't exist
      nextReview: entry.nextReview ?? now, // Due immediately for review
      interval: entry.interval ?? 0,
      easeFactor: entry.easeFactor ?? 2.5,
      reviewCount: entry.reviewCount ?? 0,
      lastReviewed: entry.lastReviewed ?? 0,
    };
  }

  /**
   * Load dictionary from localStorage into memory cache
   */
  private loadCache(): Map<string, DictionaryEntry> {
    if (this.cache) {
      return this.cache;
    }

    const stored = localStorage.getItem(DICTIONARY_KEY);
    const rawEntries: any[] = stored ? JSON.parse(stored) : [];

    this.cache = new Map();
    let needsSave = false;

    rawEntries.forEach(rawEntry => {
      const entry = this.initializeSRSFields(rawEntry);
      // Check if we had to initialize any SRS fields
      if (rawEntry.nextReview === undefined) {
        needsSave = true;
      }
      this.cache!.set(entry.word, entry);
    });

    // Save back to localStorage if we migrated any entries
    if (needsSave) {
      this.saveCache();
    }

    return this.cache;
  }

  /**
   * Save cache back to localStorage
   */
  private saveCache(): void {
    if (!this.cache) return;

    const entries = Array.from(this.cache.values());
    localStorage.setItem(DICTIONARY_KEY, JSON.stringify(entries));
  }

  /**
   * Look up a word in the dictionary
   */
  lookup(word: string): DictionaryEntry | null {
    const cache = this.loadCache();
    return cache.get(word) || null;
  }

  /**
   * Add or update a word in the dictionary
   * If word exists with different meaning, adds to meanings array
   */
  addWord(word: string, pinyin: string, translation: string): void {
    const cache = this.loadCache();
    const existing = cache.get(word);

    if (existing) {
      // Update existing entry
      existing.usageCount++;

      // Add new meaning if it doesn't exist
      if (!existing.meanings.includes(translation)) {
        existing.meanings.push(translation);
      }

      // Update pinyin if different (keep the latest)
      if (existing.pinyin !== pinyin) {
        existing.pinyin = pinyin;
      }

      cache.set(word, existing);
    } else {
      // Create new entry with SRS fields initialized
      const newEntry: DictionaryEntry = {
        word,
        pinyin,
        meanings: [translation],
        addedAt: Date.now(),
        usageCount: 1,
        // SRS fields - new words need review immediately
        nextReview: Date.now(),
        interval: 0,
        easeFactor: 2.5,
        reviewCount: 0,
        lastReviewed: 0,
      };
      cache.set(word, newEntry);
    }

    this.saveCache();
  }

  /**
   * Add multiple words at once (bulk operation)
   */
  addWords(words: Array<{ word: string; pinyin: string; translation: string }>): void {
    words.forEach(({ word, pinyin, translation }) => {
      this.addWord(word, pinyin, translation);
    });
  }

  /**
   * Get all words in the dictionary
   */
  getAllWords(): DictionaryEntry[] {
    const cache = this.loadCache();
    return Array.from(cache.values());
  }

  /**
   * Get dictionary statistics
   */
  getStats(): { totalWords: number; totalMeanings: number } {
    const words = this.getAllWords();
    return {
      totalWords: words.length,
      totalMeanings: words.reduce((sum, entry) => sum + entry.meanings.length, 0),
    };
  }

  /**
   * Clear the entire dictionary
   */
  clear(): void {
    this.cache = new Map();
    localStorage.removeItem(DICTIONARY_KEY);
  }

  /**
   * Export dictionary as JSON string
   */
  export(): string {
    return localStorage.getItem(DICTIONARY_KEY) || '[]';
  }

  /**
   * Import dictionary from JSON string
   */
  import(jsonData: string): void {
    try {
      const entries: DictionaryEntry[] = JSON.parse(jsonData);
      entries.forEach(entry => {
        this.addWord(entry.word, entry.pinyin, entry.meanings[0]);
        // Add additional meanings
        entry.meanings.slice(1).forEach(meaning => {
          this.addWord(entry.word, entry.pinyin, meaning);
        });
      });
    } catch (error) {
      console.error('Failed to import dictionary:', error);
      throw new Error('Invalid dictionary format');
    }
  }

  /**
   * Get words that need review (nextReview <= now)
   */
  getWordsForReview(): DictionaryEntry[] {
    const now = Date.now();
    const words = this.getAllWords();
    return words
      .filter(entry => entry.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview); // Oldest due first
  }

  /**
   * Update word after review with enhanced SRS algorithm
   * quality: 1=Again, 3=Hard, 4=Good, 5=Easy
   */
  updateAfterReview(word: string, quality: number): void {
    const cache = this.loadCache();
    const entry = cache.get(word);

    if (!entry) return;

    const now = Date.now();
    const wasNew = entry.reviewCount === 0;
    const wasLearning = entry.reviewCount === 1;

    entry.lastReviewed = now;

    // Enhanced SM-2 Algorithm with quality-based intervals
    if (quality === 1) {
      // Again - short interval, reset to learning
      entry.interval = 10 / (24 * 60); // 10 minutes in days
      entry.reviewCount = 0; // Reset to new
    } else if (quality === 3) {
      // Hard - conservative intervals
      if (wasNew) {
        entry.interval = 0.5; // 12 hours
        entry.reviewCount = 1;
      } else if (wasLearning) {
        entry.interval = 1; // 1 day
        entry.reviewCount = 2;
      } else {
        entry.interval = Math.max(1, entry.interval * 1.2); // Increase by 20%
        entry.reviewCount++;
      }
      // Decrease ease factor for hard cards
      entry.easeFactor = Math.max(1.3, entry.easeFactor - 0.15);
    } else if (quality === 4) {
      // Good - standard SM-2 intervals
      entry.reviewCount++;
      if (entry.reviewCount === 1) {
        entry.interval = 1; // 1 day
      } else if (entry.reviewCount === 2) {
        entry.interval = 6; // 6 days
      } else {
        entry.interval = Math.round(entry.interval * entry.easeFactor);
      }
      // Standard ease factor adjustment
      entry.easeFactor = Math.max(
        1.3,
        entry.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );
    } else if (quality === 5) {
      // Easy - longer intervals
      entry.reviewCount++;
      if (entry.reviewCount === 1) {
        entry.interval = 4; // 4 days (skip ahead)
      } else if (entry.reviewCount === 2) {
        entry.interval = 10; // 10 days
      } else {
        entry.interval = Math.round(entry.interval * entry.easeFactor * 1.3);
      }
      // Increase ease factor for easy cards
      entry.easeFactor = Math.min(2.5, entry.easeFactor + 0.15);
    }

    // Set next review date (convert days to milliseconds)
    entry.nextReview = now + entry.interval * 24 * 60 * 60 * 1000;

    cache.set(word, entry);
    this.saveCache();
  }

  /**
   * Get review statistics
   */
  getReviewStats(): { dueNow: number; dueToday: number; total: number } {
    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const endOfDayTimestamp = endOfDay.getTime();

    const words = this.getAllWords();

    return {
      dueNow: words.filter(w => w.nextReview <= now).length,
      dueToday: words.filter(w => w.nextReview <= endOfDayTimestamp).length,
      total: words.length,
    };
  }
}

export const localDictionary = new LocalDictionary();
