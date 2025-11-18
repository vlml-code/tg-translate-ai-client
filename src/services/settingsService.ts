import { TranslationSettings } from '../types';

const STORAGE_KEY = 'translationSettings';

const defaultSettings: TranslationSettings = {
  apiKey: '',
  prompt: 'Translate the following message into English while keeping the tone and intent.',
  simplifyPrompt:
    'Rewrite the following Chinese text using only words from HSK1 (or, if necessary, HSK2) while preserving the overall meaning. Return only simplified Chinese text.',
  deepseekApiKey: '',
  digestPrompt:
    'Based on the following messages, create a concise digest in English summarizing the key information, main topics, and important updates. Group related information together and highlight any action items or significant developments.'
};

const loadSettings = (): TranslationSettings => {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultSettings;
    }

    const parsed = JSON.parse(stored) as TranslationSettings;
    return {
      apiKey: parsed.apiKey || '',
      prompt: parsed.prompt || defaultSettings.prompt,
      simplifyPrompt: parsed.simplifyPrompt || defaultSettings.simplifyPrompt,
      deepseekApiKey: parsed.deepseekApiKey || '',
      digestPrompt: parsed.digestPrompt || defaultSettings.digestPrompt
    };
  } catch {
    return defaultSettings;
  }
};

const saveSettings = (settings: TranslationSettings) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const settingsService = {
  getDefaultSettings: (): TranslationSettings => ({ ...defaultSettings }),
  getSettings: (): TranslationSettings => ({ ...loadSettings() }),
  saveSettings
};
