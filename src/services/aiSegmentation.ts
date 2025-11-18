import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { pinyin } from 'pinyin-pro';
import { AISegmentationResponse, SegmentResult } from '../types';
import { localDictionary } from './localDictionary';

const MODEL = 'grok-beta';

const DEFAULT_SEGMENT_PROMPT = `Segment the following Chinese text into words and provide English translations. Return ONLY valid JSON with no additional text or markdown formatting.

Format:
{
  "segments": [
    {"word": "中国", "pinyin": "zhōngguó", "translation": "China"},
    {"word": "菜", "pinyin": "cài", "translation": "food; dish"}
  ]
}

Text to segment:`;

/**
 * Split text into sentences/lines for processing
 */
function splitIntoSentences(text: string): string[] {
  // Split by common Chinese punctuation and newlines
  const sentences = text.split(/[。！？\n；;!?]+/).filter(s => s.trim().length > 0);
  return sentences.map(s => s.trim());
}

/**
 * Call Grok API to segment a single sentence
 */
async function segmentSentenceWithAI(
  sentence: string,
  apiKey: string,
  prompt: string
): Promise<SegmentResult[]> {
  if (!apiKey?.trim()) {
    throw new Error('Please set a Grok API key in Settings before using segmentation.');
  }

  const xai = createXai({ apiKey });

  try {
    const result = await generateText({
      model: xai(MODEL),
      system: 'You are a Chinese language expert. Always respond with valid JSON only, no markdown or additional text.',
      prompt: `${prompt}\n\n${sentence}`,
      temperature: 0.3,
    });

    const content = result.text?.trim() || '';

    // Parse JSON response, removing markdown code blocks if present
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const parsed: AISegmentationResponse = JSON.parse(jsonMatch[0]);

    // Validate and ensure pinyin for each segment
    const segments = parsed.segments.map(seg => {
      // If pinyin is missing or incorrect, generate it
      const generatedPinyin = pinyin(seg.word, { toneType: 'symbol' });
      return {
        word: seg.word,
        pinyin: seg.pinyin || generatedPinyin,
        translation: seg.translation,
      };
    });

    return segments;
  } catch (error) {
    console.error('AI segmentation failed:', error);
    throw error;
  }
}

/**
 * Segment text using dictionary first, then AI for unknown words
 */
export async function segmentText(
  text: string,
  apiKey: string,
  prompt: string = DEFAULT_SEGMENT_PROMPT
): Promise<SegmentResult[]> {
  // Split text into sentences
  const sentences = splitIntoSentences(text);

  const allSegments: SegmentResult[] = [];

  // Process each sentence
  for (const sentence of sentences) {
    // Check if we already know all words in this sentence
    const knownWords = trySegmentFromDictionary(sentence);

    if (knownWords && knownWords.length > 0) {
      // We know some or all words, use dictionary
      allSegments.push(...knownWords);
    } else {
      // Unknown sentence, use AI
      try {
        const aiSegments = await segmentSentenceWithAI(sentence, apiKey, prompt);

        // Add all segments to dictionary
        aiSegments.forEach(seg => {
          localDictionary.addWord(seg.word, seg.pinyin, seg.translation);
        });

        allSegments.push(...aiSegments);
      } catch (error) {
        console.error('Failed to segment sentence:', sentence, error);
        // Fallback: treat whole sentence as one word
        allSegments.push({
          word: sentence,
          pinyin: pinyin(sentence, { toneType: 'symbol' }),
          translation: '[Translation failed]',
        });
      }
    }
  }

  return allSegments;
}

/**
 * Try to segment text using only the local dictionary
 * Returns null if any word is unknown
 */
function trySegmentFromDictionary(text: string): SegmentResult[] | null {
  const segments: SegmentResult[] = [];
  let i = 0;

  while (i < text.length) {
    let found = false;

    // Try matching longest word first (up to 4 characters)
    for (let len = Math.min(4, text.length - i); len > 0; len--) {
      const word = text.substring(i, i + len);
      const entry = localDictionary.lookup(word);

      if (entry) {
        segments.push({
          word: entry.word,
          pinyin: entry.pinyin,
          translation: entry.meanings[0], // Use first meaning
        });
        i += len;
        found = true;
        break;
      }
    }

    if (!found) {
      // Unknown word - return null to trigger AI segmentation
      return null;
    }
  }

  return segments;
}

/**
 * Get default segmentation prompt
 */
export function getDefaultSegmentPrompt(): string {
  return DEFAULT_SEGMENT_PROMPT;
}
