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
   * Update word after review with SRS algorithm (SM-2)
   * quality: 0-5 (0=complete blackout, 5=perfect response)
   */
  updateAfterReview(word: string, quality: number): void {
    const cache = this.loadCache();
    const entry = cache.get(word);

    if (!entry) return;

    const now = Date.now();
    entry.reviewCount++;
    entry.lastReviewed = now;

    // SM-2 Algorithm
    if (quality >= 3) {
      // Correct response
      if (entry.reviewCount === 1) {
        entry.interval = 1;
      } else if (entry.reviewCount === 2) {
        entry.interval = 6;
      } else {
        entry.interval = Math.round(entry.interval * entry.easeFactor);
      }

      // Update ease factor
      entry.easeFactor = Math.max(
        1.3,
        entry.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );
    } else {
      // Incorrect response - reset interval
      entry.interval = 1;
      entry.reviewCount = 1;
    }

    // Set next review date
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
