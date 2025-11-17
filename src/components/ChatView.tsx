import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MessageInfo, TranslationSettings } from '../types';
import { telegramService } from '../services/telegramClient';
import { translationService } from '../services/translationService';
import './ChatView.css';

const TranslateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 4H12V6H9.7C10.55 8.06 12 9.79 13.97 11.01L12.82 12.73C11.08 11.64 9.63 10.1 8.64 8.26C7.79 10.09 6.67 11.7 5.35 13H8V15H2V13H3.59C5.39 11.31 6.8 9.29 7.7 7H4V4ZM18.5 10H21L15 22H12.5L13.88 19.28L10 10H12.5L15.25 16.36L18.5 10Z"
      fill="currentColor"
    />
  </svg>
);

interface ChatViewProps {
  chatId: string;
  chatTitle: string;
  translationSettings: TranslationSettings;
}

interface TranslationState {
  [messageId: number]: {
    translatedText?: string;
    isShowingTranslation: boolean;
    isLoading: boolean;
    error?: string;
  };
}

export const ChatView: React.FC<ChatViewProps> = ({
  chatId,
  chatTitle,
  translationSettings
}) => {
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [translations, setTranslations] = useState<TranslationState>({});
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Load initial messages
  useEffect(() => {
    loadMessages(true);
    isInitialLoad.current = true;
    setTranslations({});
  }, [chatId]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom();
      isInitialLoad.current = false;
    }
  }, [messages]);

  const loadMessages = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setMessages([]);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const offsetId = reset ? 0 : (messages[0]?.id || 0);
      const newMessages = await telegramService.getMessages(chatId, 50, offsetId);

      if (newMessages.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => reset ? newMessages : [...newMessages, ...prev]);
      }

      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    // Check if scrolled near top (within 100px)
    if (container.scrollTop < 100) {
      const previousScrollHeight = container.scrollHeight;
      const previousScrollTop = container.scrollTop;

      loadMessages(false).then(() => {
        // Maintain scroll position after loading more messages
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop =
            previousScrollTop + (newScrollHeight - previousScrollHeight);
        }
      });
    }
  }, [loadingMore, hasMore, messages]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return messageDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const renderDateSeparator = (currentMsg: MessageInfo, previousMsg: MessageInfo | null) => {
    const label = formatDate(currentMsg.date);
    if (!previousMsg) {
      return (
        <div className="date-separator" data-date={label}>
          {label}
        </div>
      );
    }

    const currentDate = currentMsg.date.toDateString();
    const previousDate = previousMsg.date.toDateString();

    if (currentDate !== previousDate) {
      return (
        <div className="date-separator" data-date={label}>
          {label}
        </div>
      );
    }

    return null;
  };

  const handleTranslateClick = async (message: MessageInfo) => {
    if (!message.text?.trim()) {
      return;
    }

    const state = translations[message.id];
    if (state?.isLoading) {
      return;
    }

    if (state?.translatedText) {
      setTranslations((prev) => ({
        ...prev,
        [message.id]: {
          ...state,
          isShowingTranslation: !state.isShowingTranslation,
          error: undefined
        }
      }));
      return;
    }

    setTranslations((prev) => ({
      ...prev,
      [message.id]: {
        translatedText: state?.translatedText,
        isShowingTranslation: state?.isShowingTranslation ?? false,
        isLoading: true,
        error: undefined
      }
    }));

    try {
      const translatedText = await translationService.translateMessage({
        chatId,
        messageId: message.id,
        text: message.text,
        settings: translationSettings
      });

      setTranslations((prev) => ({
        ...prev,
        [message.id]: {
          translatedText,
          isShowingTranslation: true,
          isLoading: false,
          error: undefined
        }
      }));
    } catch (err: any) {
      setTranslations((prev) => ({
        ...prev,
        [message.id]: {
          translatedText: state?.translatedText,
          isShowingTranslation: false,
          isLoading: false,
          error: err?.message || 'Failed to translate this message.'
        }
      }));
    }
  };

  const renderTranslateButtonLabel = (messageId: number) => {
    const state = translations[messageId];

    if (state?.isShowingTranslation) {
      return 'Show original';
    }

    if (state?.translatedText) {
      return 'Show translation';
    }

    if (state?.isLoading) {
      return 'Translating...';
    }

    return 'Translate';
  };

  if (loading) {
    return (
      <div className="chat-view">
        <div className="chat-view-header">
          <h2>{chatTitle}</h2>
        </div>
        <div className="loading-container">
          <div className="loading">Loading messages...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-view">
        <div className="chat-view-header">
          <h2>{chatTitle}</h2>
        </div>
        <div className="error-container">
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <div className="chat-view-header">
        <h2>{chatTitle}</h2>
      </div>

      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loadingMore && (
          <div className="loading-more">Loading more messages...</div>
        )}

        {!hasMore && messages.length > 0 && (
          <div className="no-more-messages">No more messages</div>
        )}

        {messages.map((message, index) => {
          const translationState = translations[message.id];
          const canTranslate = Boolean(message.text?.trim());

          return (
            <React.Fragment key={message.id}>
              {renderDateSeparator(message, index > 0 ? messages[index - 1] : null)}
              <div className={`message ${message.isOutgoing ? 'outgoing' : 'incoming'}`}>
                {!message.isOutgoing && (
                  <div className="message-sender">{message.senderName}</div>
                )}
                <div className="message-bubble">
                  <div className="message-text">{message.text || '[Media]'}</div>
                  {translationState?.isShowingTranslation && translationState.translatedText && (
                    <div className="message-translation">
                      {translationState.translatedText}
                    </div>
                  )}
                  <div className="message-time">{formatTime(message.date)}</div>
                </div>
                <div className="message-actions">
                  <button
                    className="translate-btn"
                    onClick={() => handleTranslateClick(message)}
                    disabled={!canTranslate || translationState?.isLoading}
                  >
                    <TranslateIcon />
                    <span>{renderTranslateButtonLabel(message.id)}</span>
                  </button>
                  {translationState?.error && (
                    <span className="translation-error">{translationState.error}</span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
