import { DictionaryEntry } from '../types';

const DICTIONARY_KEY = 'chinese_dictionary';

/**
 * Local dictionary service using localStorage
 * Stores learned Chinese words with their meanings
 */
class LocalDictionary {
  private cache: Map<string, DictionaryEntry> | null = null;

  /**
   * Load dictionary from localStorage into memory cache
   */
  private loadCache(): Map<string, DictionaryEntry> {
    if (this.cache) {
      return this.cache;
    }

    const stored = localStorage.getItem(DICTIONARY_KEY);
    const entries: DictionaryEntry[] = stored ? JSON.parse(stored) : [];

    this.cache = new Map();
    entries.forEach(entry => {
      this.cache!.set(entry.word, entry);
    });

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
      // Create new entry
      const newEntry: DictionaryEntry = {
        word,
        pinyin,
        meanings: [translation],
        addedAt: Date.now(),
        usageCount: 1,
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
}

export const localDictionary = new LocalDictionary();
