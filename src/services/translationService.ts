import { APICallError, generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';

import { TranslationSettings } from '../types';

const MODEL = 'grok-4-fast';
const CACHE_STORAGE_KEY = 'messageTranslations';
const DEFAULT_PROMPT =
  'Translate the following Telegram message into English while preserving tone, intent, emojis, and formatting.';
const DEFAULT_SIMPLIFY_PROMPT =
  'Rewrite the following Chinese text using only vocabulary from HSK1 or, if needed, HSK2. Keep the text in Chinese while preserving its meaning and tone.';

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

interface GenerationParams {
  chatId: string;
  messageId: number;
  text: string;
  apiKey: string;
  prompt: string;
}

const buildCacheKey = (chatId: string, messageId: number, prompt?: string) =>
  `${chatId}:${messageId}:${(prompt || '').trim() || 'default'}`;

const generateWithPrompt = async ({ chatId, messageId, text, apiKey, prompt }: GenerationParams) => {
  if (!apiKey?.trim()) {
    throw new Error('Please set a Grok API key in Settings before translating messages.');
  }

  const trimmedText = text?.trim();
  if (!trimmedText) {
    throw new Error('This message has no text to translate.');
  }

  const resolvedPrompt = prompt?.trim() || DEFAULT_PROMPT;

  const cacheKey = buildCacheKey(chatId, messageId, resolvedPrompt);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const xai = createXai({
    apiKey
  });

  let resultText: string | undefined;

  try {
    const result = await generateText({
      model: xai(MODEL),
      system: resolvedPrompt,
      prompt: trimmedText
    });
    resultText = result.text?.trim();
  } catch (error) {
    if (APICallError.isInstance(error)) {
      const apiError = error as { statusCode?: number; message: string };
      if (apiError.statusCode === 404) {
        throw new Error(
          'The Grok translation endpoint returned 404. Please confirm your API key is valid and that https://api.x.ai is reachable.'
        );
      }

      const responseDetails = apiError.statusCode ? ` (${apiError.statusCode})` : '';
      throw new Error(`Grok API request failed${responseDetails}: ${apiError.message}`);
    }

    throw error instanceof Error
      ? new Error(`Grok translation failed: ${error.message}`)
      : new Error('Grok translation failed due to an unknown error.');
  }

  if (!resultText) {
    throw new Error('Grok API did not return any content.');
  }

  cache.set(cacheKey, resultText);
  return resultText;
};

const translateMessage = async ({ chatId, messageId, text, settings }: TranslateParams) =>
  generateWithPrompt({
    chatId,
    messageId,
    text,
    apiKey: settings.apiKey,
    prompt: settings.prompt || DEFAULT_PROMPT
  });

const simplifyMessage = async ({ chatId, messageId, text, settings }: TranslateParams) =>
  generateWithPrompt({
    chatId,
    messageId,
    text,
    apiKey: settings.apiKey,
    prompt: settings.simplifyPrompt || DEFAULT_SIMPLIFY_PROMPT
  });

export const translationService = {
  translateMessage,
  simplifyMessage
};
