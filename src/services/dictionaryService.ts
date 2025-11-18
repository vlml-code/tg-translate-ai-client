import { pinyin } from 'pinyin-pro';
import { localDictionary } from './localDictionary';

export interface SegmentedWord {
  word: string;
  pinyinNum: string[];      // Numeric pinyin per character
  pinyinMarked: string;     // Pretty tone marks
  english: string | null;   // English definition
  toneCategory: string;     // For color coding
}

/**
 * Get the tone category from numeric pinyin for color coding
 */
function getToneCategory(numericPinyin: string): string {
  const match = numericPinyin?.match(/([1-5])$/);
  return match?.[1] || '0';
}

/**
 * Get the dominant tone from a word (uses the first tone found)
 */
function getDominantTone(pinyinNumArray: string[]): string {
  for (const py of pinyinNumArray) {
    const tone = getToneCategory(py);
    if (tone !== '0') {
      return tone;
    }
  }
  return '0';
}

/**
 * Analyze Chinese text using local dictionary
 * This is used for passive pinyin display, not for learning segmentation
 */
export async function analyzeChineseText(text: string): Promise<SegmentedWord[]> {
  const result: SegmentedWord[] = [];

  // Process character by character for now
  // The AI segmentation button is what learns and teaches the dictionary
  for (const char of text) {
    // Skip non-Chinese characters
    if (!/[\u3400-\u9FFF]/.test(char)) {
      result.push({
        word: char,
        pinyinNum: [],
        pinyinMarked: '',
        english: null,
        toneCategory: '0',
      });
      continue;
    }

    // Get pinyin for the character
    const pyNumArray = pinyin(char, { toneType: 'num', type: 'array' });

    // Try to look up in local dictionary
    const dictEntry = localDictionary.lookup(char);

    // Generate tone-marked pinyin
    const pyMarked = pinyin(char, { toneType: 'symbol' });

    // Get tone category for color coding
    const toneCategory = getDominantTone(pyNumArray);

    result.push({
      word: char,
      pinyinNum: pyNumArray,
      pinyinMarked: dictEntry?.pinyin || pyMarked,
      english: dictEntry?.meanings[0] || null,
      toneCategory,
    });
  }

  return result;
}

/**
 * Check if a text contains Chinese characters
 */
export function containsChinese(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}
