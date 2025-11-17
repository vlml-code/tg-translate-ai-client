import { useState, useEffect } from 'react';
import { AuthForm } from './components/AuthForm';
import { ChatList } from './components/ChatList';
import { ChatView } from './components/ChatView';
import { SettingsModal } from './components/SettingsModal';
import { telegramService } from './services/telegramClient';
import { settingsService } from './services/settingsService';
import { TranslationSettings } from './types';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatTitle, setSelectedChatTitle] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<TranslationSettings>(
    settingsService.getSettings()
  );

  useEffect(() => {
    initializeTelegram();
  }, []);

  const initializeTelegram = async () => {
    try {
      await telegramService.initialize();
      const authorized = await telegramService.isAuthorized();
      setIsAuthenticated(authorized);
    } catch (error) {
      console.error('Failed to initialize Telegram client:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
  };

  const handleChatSelect = (chatId: string, chatTitle: string) => {
    setSelectedChatId(chatId);
    setSelectedChatTitle(chatTitle);
  };

  const handleSaveSettings = (nextSettings: TranslationSettings) => {
    settingsService.saveSettings(nextSettings);
    setSettings(nextSettings);
  };

  if (isInitializing) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Initializing Telegram client...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      <div className="app">
        <ChatList
          onChatSelect={handleChatSelect}
          selectedChatId={selectedChatId}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        {selectedChatId ? (
          <ChatView
            chatId={selectedChatId}
            chatTitle={selectedChatTitle}
            translationSettings={settings}
          />
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <svg
                width="120"
                height="120"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h2>Select a chat to start messaging</h2>
              <p>Choose a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialSettings={settings}
        onSave={handleSaveSettings}
      />
    </>
  );
}

export default App;
