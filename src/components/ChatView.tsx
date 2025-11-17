import React, { useEffect, useState, useRef, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';
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

const SimplifyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 7H20M4 12H12M4 17H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface ChatViewProps {
  chatId: string;
  chatTitle: string;
  translationSettings: TranslationSettings;
}

type ToneCategory = '0' | '1' | '2' | '3' | '4' | '5';

const CHINESE_CHAR_REGEX = /[\u3400-\u9FFF]/u;

const getToneCategory = (numericPinyin: string): ToneCategory => {
  const match = numericPinyin?.match(/([1-5])$/);
  return (match?.[1] as ToneCategory) || '0';
};

const renderMessageTextWithPinyin = (text: string, messageKey: string | number) => {
  const nodes: React.ReactNode[] = [];
  let buffer = '';
  let bufferIndex = 0;

  const pushBuffer = () => {
    if (!buffer) return;
    nodes.push(
      <span key={`buffer-${messageKey}-${bufferIndex++}`} className="message-text-chunk">
        {buffer}
      </span>
    );
    buffer = '';
  };

  Array.from(text).forEach((char, index) => {
    if (CHINESE_CHAR_REGEX.test(char)) {
      pushBuffer();
      const tooltip = pinyin(char);
      const toneCategory = getToneCategory(pinyin(char, { toneType: 'num' }));

      nodes.push(
        <span
          key={`char-${messageKey}-${index}`}
          className="chinese-char"
          data-pinyin={tooltip}
          data-tone={toneCategory}
        >
          {char}
        </span>
      );
    } else {
      buffer += char;
    }
  });

  pushBuffer();

  return nodes;
};

type AugmentationType = 'translation' | 'simplification';

interface AugmentationState {
  content?: string;
  isShowing: boolean;
  isLoading: boolean;
  error?: string;
}

interface MessageAugmentations {
  translation: AugmentationState;
  simplification: AugmentationState;
}

type TranslationState = Record<number, MessageAugmentations>;

const createAugmentationState = (): AugmentationState => ({
  isShowing: false,
  isLoading: false,
  error: undefined,
  content: undefined
});

const createMessageAugmentations = (): MessageAugmentations => ({
  translation: createAugmentationState(),
  simplification: createAugmentationState()
});

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

  const handleAugmentationClick = async (message: MessageInfo, type: AugmentationType) => {
    if (!message.text?.trim()) {
      return;
    }

    const messageState = translations[message.id] || createMessageAugmentations();
    const augmentationState = messageState[type];

    if (augmentationState.isLoading) {
      return;
    }

    if (augmentationState.content) {
      setTranslations((prev) => {
        const prevState = prev[message.id] || createMessageAugmentations();
        return {
          ...prev,
          [message.id]: {
            ...prevState,
            [type]: {
              ...prevState[type],
              isShowing: !prevState[type].isShowing,
              error: undefined
            }
          }
        };
      });
      return;
    }

    setTranslations((prev) => {
      const prevState = prev[message.id] || createMessageAugmentations();
      return {
        ...prev,
        [message.id]: {
          ...prevState,
          [type]: {
            ...prevState[type],
            isLoading: true,
            error: undefined
          }
        }
      };
    });

    try {
      const content =
        type === 'translation'
          ? await translationService.translateMessage({
              chatId,
              messageId: message.id,
              text: message.text,
              settings: translationSettings
            })
          : await translationService.simplifyMessage({
              chatId,
              messageId: message.id,
              text: message.text,
              settings: translationSettings
            });

      setTranslations((prev) => {
        const prevState = prev[message.id] || createMessageAugmentations();
        return {
          ...prev,
          [message.id]: {
            ...prevState,
            [type]: {
              ...prevState[type],
              content,
              isShowing: true,
              isLoading: false,
              error: undefined
            }
          }
        };
      });
    } catch (err: any) {
      setTranslations((prev) => {
        const prevState = prev[message.id] || createMessageAugmentations();
        return {
          ...prev,
          [message.id]: {
            ...prevState,
            [type]: {
              ...prevState[type],
              isLoading: false,
              error: err?.message || 'Failed to process this message.'
            }
          }
        };
      });
    }
  };

  const renderActionButtonLabel = (messageId: number, type: AugmentationType) => {
    const state = translations[messageId]?.[type];

    if (state?.isShowing) {
      return 'Show original';
    }

    if (state?.content) {
      return type === 'translation' ? 'Show translation' : 'Show simplified';
    }

    if (state?.isLoading) {
      return type === 'translation' ? 'Translating...' : 'Simplifying...';
    }

    return type === 'translation' ? 'Translate' : 'Simplify';
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
          const translationContent = translationState?.translation;
          const simplificationContent = translationState?.simplification;

          return (
            <React.Fragment key={message.id}>
              {renderDateSeparator(message, index > 0 ? messages[index - 1] : null)}
              <div className={`message ${message.isOutgoing ? 'outgoing' : 'incoming'}`}>
                {!message.isOutgoing && (
                  <div className="message-sender">{message.senderName}</div>
                )}
                <div className="message-bubble">
                  <div className="message-text">
                    {message.text
                      ? renderMessageTextWithPinyin(message.text, `msg-${message.id}`)
                      : '[Media]'}
                  </div>
                  {translationContent?.isShowing && translationContent.content && (
                    <div className="message-translation">
                      {translationContent.content}
                    </div>
                  )}
                  {simplificationContent?.isShowing && simplificationContent.content && (
                    <div className="message-simplified">
                      {renderMessageTextWithPinyin(
                        simplificationContent.content,
                        `simplified-${message.id}`
                      )}
                    </div>
                  )}
                  <div className="message-time">{formatTime(message.date)}</div>
                </div>
                <div className="message-actions">
                  <button
                    className="translate-btn"
                    onClick={() => handleAugmentationClick(message, 'translation')}
                    disabled={!canTranslate || translationContent?.isLoading}
                  >
                    <TranslateIcon />
                    <span>{renderActionButtonLabel(message.id, 'translation')}</span>
                  </button>
                  {translationContent?.error && (
                    <span className="translation-error">{translationContent.error}</span>
                  )}
                  <button
                    className="translate-btn simplify"
                    onClick={() => handleAugmentationClick(message, 'simplification')}
                    disabled={!canTranslate || simplificationContent?.isLoading}
                  >
                    <SimplifyIcon />
                    <span>{renderActionButtonLabel(message.id, 'simplification')}</span>
                  </button>
                  {simplificationContent?.error && (
                    <span className="translation-error">{simplificationContent.error}</span>
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
