import { segment, pinyin, convert } from 'pinyin-pro';

export interface SegmentedWord {
  word: string;
  pinyinNum: string[];      // Numeric pinyin per character
  pinyinMarked: string;     // Pretty tone marks
  english: string | null;   // English definition
  toneCategory: string;     // For color coding
}

// Lazy-load cc-cedict to avoid memory issues during build
let cedictInstance: any = null;

async function getCedict() {
  if (!cedictInstance) {
    const cedictModule = await import('cc-cedict');
    cedictInstance = cedictModule.default;
  }
  return cedictInstance;
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
 * Analyze Chinese text and segment it into words with dictionary definitions
 */
export async function analyzeChineseText(text: string): Promise<SegmentedWord[]> {
  // 1. Segment Chinese into words
  // segment() with no options returns a space-separated string
  // We need to use it and split the result, or check the actual return type
  const segmentResult = segment(text);

  // Handle different return types from segment()
  let words: string[];
  if (typeof segmentResult === 'string') {
    // If it's a string, split by spaces
    words = segmentResult.split(' ').filter(w => w.length > 0);
  } else if (Array.isArray(segmentResult)) {
    // If it's an array, extract strings from objects or use as-is
    words = segmentResult.map((item: any) => {
      if (typeof item === 'string') {
        return item;
      } else if (typeof item === 'object' && item !== null) {
        return item.origin || item.result || String(item);
      }
      return String(item);
    });
  } else {
    // Fallback: just use the original text
    words = [text];
  }

  // 2. Lazy-load dictionary
  const cedict = await getCedict();

  const results = words.map((word: string) => {
    // Skip non-Chinese words (punctuation, English, etc.)
    if (!/[\u3400-\u9FFF]/.test(word)) {
      return {
        word,
        pinyinNum: [],
        pinyinMarked: '',
        english: null,
        toneCategory: '0',
      };
    }

    // 3. Get pinyin with tone numbers for matching
    const pyNumArray = pinyin(word, { toneType: 'num', type: 'array' });
    const pyNum = pyNumArray.join(' ');  // e.g., 'zhong1 guo2'

    // 4. Get dictionary entries from CC-CEDICT
    let entries: any = null;
    let english: string | null = null;

    try {
      entries = cedict.getBySimplified(word, pyNum);
      // Extract the first English definition
      if (entries && typeof entries === 'object') {
        const pinyinKeys = Object.keys(entries);
        if (pinyinKeys.length > 0) {
          const firstKey = pinyinKeys[0];
          const definitions = entries[firstKey];
          if (Array.isArray(definitions) && definitions.length > 0) {
            english = definitions[0]?.english ?? null;
          }
        }
      }
    } catch (error) {
      // If lookup fails, continue without definition
      english = null;
    }

    // 5. Convert to pretty tone marks
    const pyMarked = convert(pyNum);   // e.g., 'zhōng guó'

    // 6. Get tone category for color coding
    const toneCategory = getDominantTone(pyNumArray);

    return {
      word,
      pinyinNum: pyNumArray,
      pinyinMarked: pyMarked,
      english,
      toneCategory,
    };
  });

  return results;
}

/**
 * Check if a text contains Chinese characters
 */
export function containsChinese(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}
