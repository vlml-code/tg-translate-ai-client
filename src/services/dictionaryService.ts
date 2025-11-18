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
  // 1. Segment Chinese into words (not characters!)
  // segment() returns array of { origin: '硕士', result: 'shuòshì' } objects
  const segmentResult = segment(text);

  // Extract the 'origin' (Chinese word) from each segment object
  let words: string[];
  if (Array.isArray(segmentResult)) {
    words = segmentResult.map((item: any) => {
      // Extract origin (the Chinese text) from each segment
      if (typeof item === 'object' && item !== null && 'origin' in item) {
        return item.origin;
      }
      // Fallback to string if format is different
      return typeof item === 'string' ? item : String(item);
    });
  } else if (typeof segmentResult === 'string') {
    // If somehow it returns a string, split by spaces
    words = segmentResult.split(/\s+/).filter(w => w.length > 0);
  } else {
    // Fallback: treat as single word
    words = [text];
  }

  console.log('Segmented words:', words); // Debug logging

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
