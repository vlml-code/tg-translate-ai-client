import { TranslationSettings } from '../types';

const API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = 'grok-beta';
const CACHE_STORAGE_KEY = 'messageTranslations';

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

const buildCacheKey = (chatId: string, messageId: number) => `${chatId}:${messageId}`;

const translateMessage = async ({ chatId, messageId, text, settings }: TranslateParams) => {
  if (!settings.apiKey) {
    throw new Error('Please set a Grok API key in Settings before translating messages.');
  }

  const trimmedText = text?.trim();
  if (!trimmedText) {
    throw new Error('This message has no text to translate.');
  }

  const cacheKey = buildCacheKey(chatId, messageId);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            settings.prompt ||
            'Translate the following message into English while keeping the tone and intent.'
        },
        {
          role: 'user',
          content: trimmedText
        }
      ]
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const errorMessage = errorPayload?.error?.message || response.statusText;
    throw new Error(`Grok API request failed: ${errorMessage}`);
  }

  const payload = await response.json();
  const translation: string | undefined = payload?.choices?.[0]?.message?.content?.trim();

  if (!translation) {
    throw new Error('Grok API did not return any content.');
  }

  cache.set(cacheKey, translation);
  return translation;
};

export const translationService = {
  translateMessage
};
