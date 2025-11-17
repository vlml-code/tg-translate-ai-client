import { APICallError, generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';

import { TranslationSettings } from '../types';

const MODEL = 'grok-4-fast';
const CACHE_STORAGE_KEY = 'messageTranslations';
const DEFAULT_PROMPT =
  'Translate the following Telegram message into English while preserving tone, intent, emojis, and formatting.';

type CacheRecord = Record<string, string>;

class TranslationCache {
  private cache: CacheRecord;

  constructor() {
    this.cache = this.loadCache();
  }

  private loadCache(): CacheRecord {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const stored = window.localStorage.getItem(CACHE_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as CacheRecord) : {};
    } catch {
      return {};
    }
  }

  private persist() {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(this.cache));
  }

  get(key: string) {
    return this.cache[key];
  }

  set(key: string, value: string) {
    this.cache[key] = value;
    this.persist();
  }
}

const cache = new TranslationCache();

interface TranslateParams {
  chatId: string;
  messageId: number;
  text: string;
  settings: TranslationSettings;
}

const buildCacheKey = (chatId: string, messageId: number, prompt?: string) =>
  `${chatId}:${messageId}:${(prompt || '').trim() || 'default'}`;

const translateMessage = async ({ chatId, messageId, text, settings }: TranslateParams) => {
  if (!settings.apiKey) {
    throw new Error('Please set a Grok API key in Settings before translating messages.');
  }

  const trimmedText = text?.trim();
  if (!trimmedText) {
    throw new Error('This message has no text to translate.');
  }

  const cacheKey = buildCacheKey(chatId, messageId, settings.prompt);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const xai = createXai({
    apiKey: settings.apiKey
  });

  let translation: string | undefined;

  try {
    const result = await generateText({
      model: xai(MODEL),
      system: settings.prompt?.trim() || DEFAULT_PROMPT,
      prompt: trimmedText
    });
    translation = result.text?.trim();
  } catch (error) {
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 404) {
        throw new Error(
          'The Grok translation endpoint returned 404. Please confirm your API key is valid and that https://api.x.ai is reachable.'
        );
      }

      const responseDetails = error.statusCode ? ` (${error.statusCode})` : '';
      throw new Error(`Grok API request failed${responseDetails}: ${error.message}`);
    }

    throw error instanceof Error
      ? new Error(`Grok translation failed: ${error.message}`)
      : new Error('Grok translation failed due to an unknown error.');
  }

  if (!translation) {
    throw new Error('Grok API did not return any content.');
  }

  cache.set(cacheKey, translation);
  return translation;
};

export const translationService = {
  translateMessage
};
