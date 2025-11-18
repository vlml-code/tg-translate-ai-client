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
 * Analyze Chinese text using local dictionary with greedy word matching
 * This scans the text and tries to match the longest words from the dictionary
 */
export async function analyzeChineseText(text: string): Promise<SegmentedWord[]> {
  const result: SegmentedWord[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Skip non-Chinese characters
    if (!/[\u3400-\u9FFF]/.test(char)) {
      result.push({
        word: char,
        pinyinNum: [],
        pinyinMarked: '',
        english: null,
        toneCategory: '0',
      });
      i++;
      continue;
    }

    // Try to match the longest word from dictionary (up to 6 characters)
    let matched = false;
    for (let len = Math.min(6, text.length - i); len > 0; len--) {
      const word = text.substring(i, i + len);
      const dictEntry = localDictionary.lookup(word);

      if (dictEntry) {
        // Found a match in dictionary!
        const pyNumArray = pinyin(word, { toneType: 'num', type: 'array' });
        const toneCategory = getDominantTone(pyNumArray);

        result.push({
          word: dictEntry.word,
          pinyinNum: pyNumArray,
          pinyinMarked: dictEntry.pinyin,
          english: dictEntry.meanings[0],
          toneCategory,
        });

        i += len;
        matched = true;
        break;
      }
    }

    // No dictionary match - fall back to single character
    if (!matched) {
      const pyNumArray = pinyin(char, { toneType: 'num', type: 'array' });
      const pyMarked = pinyin(char, { toneType: 'symbol' });
      const toneCategory = getDominantTone(pyNumArray);

      result.push({
        word: char,
        pinyinNum: pyNumArray,
        pinyinMarked: pyMarked,
        english: null,
        toneCategory,
      });

      i++;
    }
  }

  return result;
}

/**
 * Check if a text contains Chinese characters
 */
export function containsChinese(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}
