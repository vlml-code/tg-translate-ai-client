import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MessageInfo } from '../types';
import { telegramService } from '../services/telegramClient';
import './ChatView.css';

interface ChatViewProps {
  chatId: string;
  chatTitle: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ chatId, chatTitle }) => {
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Load initial messages
  useEffect(() => {
    loadMessages(true);
    isInitialLoad.current = true;
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
    if (!previousMsg) return <div className="date-separator">{formatDate(currentMsg.date)}</div>;

    const currentDate = currentMsg.date.toDateString();
    const previousDate = previousMsg.date.toDateString();

    if (currentDate !== previousDate) {
      return <div className="date-separator">{formatDate(currentMsg.date)}</div>;
    }

    return null;
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

        {messages.map((message, index) => (
          <React.Fragment key={message.id}>
            {renderDateSeparator(message, index > 0 ? messages[index - 1] : null)}
            <div className={`message ${message.isOutgoing ? 'outgoing' : 'incoming'}`}>
              {!message.isOutgoing && (
                <div className="message-sender">{message.senderName}</div>
              )}
              <div className="message-bubble">
                <div className="message-text">{message.text || '[Media]'}</div>
                <div className="message-time">{formatTime(message.date)}</div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
