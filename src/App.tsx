import { useState, useEffect } from 'react';
import { AuthForm } from './components/AuthForm';
import { ChatList } from './components/ChatList';
import { ChatView } from './components/ChatView';
import { SettingsModal } from './components/SettingsModal';
import { CompactChatsPage } from './components/CompactChatsPage';
import { telegramService } from './services/telegramClient';
import { settingsService } from './services/settingsService';
import { TranslationSettings } from './types';
import './App.css';

type AppView = 'chats' | 'archive';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatTitle, setSelectedChatTitle] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [settings, setSettings] = useState<TranslationSettings>(
    settingsService.getSettings()
  );
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    initializeTelegram();
  }, []);

  const initializeTelegram = async () => {
    try {
      await telegramService.initialize();
      const authorized = await telegramService.isAuthorized();
      setIsAuthenticated(authorized);
      setStartupError(null);
    } catch (error) {
      console.error('Failed to initialize Telegram client:', error);
      const message = (error as Error)?.message || 'Unknown error';
      if (message === 'AUTH_KEY_DUPLICATED') {
        setStartupError(
          'We detected an active Telegram session from another device. The cached key was cleared so you can request a fresh login code. If codes still do not arrive, terminate other sessions from Telegram > Settings > Devices.'
        );
      } else {
        setStartupError(
          'Unable to start the Telegram client. Please verify your API credentials and try again.'
        );
      }
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
    return (
      <AuthForm
        onAuthenticated={handleAuthenticated}
        startupError={startupError || undefined}
      />
    );
  }

  if (currentView === 'archive') {
    return (
      <CompactChatsPage onBack={() => setCurrentView('chats')} />
    );
  }

  return (
    <>
      <div className="app">
        <ChatList
          onChatSelect={handleChatSelect}
          selectedChatId={selectedChatId}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenArchive={() => setCurrentView('archive')}
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
