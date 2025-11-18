import React, { useState, useEffect } from 'react';
import { TranslationSettings, ChatInfo } from '../types';
import { telegramService } from '../services/telegramClient';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: TranslationSettings;
  onSave: (settings: TranslationSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialSettings,
  onSave
}) => {
  const [settings, setSettings] = useState<TranslationSettings>(initialSettings);
  const [postableChats, setPostableChats] = useState<ChatInfo[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    if (isOpen) {
      loadPostableChannels();
    }
  }, [isOpen]);

  const loadPostableChannels = async () => {
    try {
      setLoadingChannels(true);
      const chats = await telegramService.getPostableChats();
      setPostableChats(chats);
    } catch (error) {
      console.error('Failed to load postable channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(settings);
    onClose();
  };

  return (
    <div className="settings-modal-overlay" role="dialog" aria-modal="true">
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2>Translation Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="settings-form">
          <label className="form-field">
            <span>Grok API key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="xai-..."
              autoComplete="off"
            />
          </label>

          <label className="form-field">
            <span>Translation prompt</span>
            <textarea
              value={settings.prompt}
              onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
              rows={3}
            />
            <small>This prompt is sent as the system instruction before your message.</small>
          </label>

          <label className="form-field">
            <span>Simplify prompt</span>
            <textarea
              value={settings.simplifyPrompt}
              onChange={(e) => setSettings({ ...settings, simplifyPrompt: e.target.value })}
              rows={3}
            />
            <small>
              Used when you tap <strong>Simplify</strong>. Keep it focused on rewriting Chinese text with only HSK1/HSK2
              vocabulary.
            </small>
          </label>

          <label className="form-field">
            <span>DeepSeek API key</span>
            <input
              type="password"
              value={settings.deepseekApiKey}
              onChange={(e) => setSettings({ ...settings, deepseekApiKey: e.target.value })}
              placeholder="sk-..."
              autoComplete="off"
            />
            <small>Used for generating digests from monitored messages.</small>
          </label>

          <label className="form-field">
            <span>Digest prompt</span>
            <textarea
              value={settings.digestPrompt}
              onChange={(e) => setSettings({ ...settings, digestPrompt: e.target.value })}
              rows={3}
            />
            <small>
              This prompt guides how DeepSeek creates digests from your monitored channel messages.
            </small>
          </label>

          <label className="form-field">
            <span>Digest target channel</span>
            {loadingChannels ? (
              <div style={{ padding: '0.5rem', fontSize: '0.9rem', color: 'var(--tg-text-secondary)' }}>
                Loading channels...
              </div>
            ) : postableChats.length === 0 ? (
              <div style={{ padding: '0.5rem', fontSize: '0.9rem', color: 'var(--tg-text-secondary)' }}>
                No channels found where you can post. You need admin rights.
              </div>
            ) : (
              <select
                value={settings.digestTargetChannelId}
                onChange={(e) => setSettings({ ...settings, digestTargetChannelId: e.target.value })}
                style={{
                  background: 'rgba(12, 19, 28, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  color: 'var(--tg-text-primary)',
                  width: '100%'
                }}
              >
                <option value="">None (don't send digests)</option>
                {postableChats.map((chat) => (
                  <option key={chat.id} value={chat.id}>
                    {chat.title} {chat.isChannel ? '(Channel)' : '(Group)'}
                  </option>
                ))}
              </select>
            )}
            <small>
              Digests will be automatically sent to this channel after monitoring completes.
            </small>
          </label>
        </div>

        <div className="settings-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
