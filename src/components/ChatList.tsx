import React, { useEffect, useState } from 'react';
import { ChatInfo } from '../types';
import { telegramService } from '../services/telegramClient';
import './ChatList.css';

interface ChatListProps {
  onChatSelect: (chatId: string, chatTitle: string) => void;
  selectedChatId: string | null;
}

export const ChatList: React.FC<ChatListProps> = ({ onChatSelect, selectedChatId }) => {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const chatList = await telegramService.getChats();
      setChats(chatList);
    } catch (err: any) {
      setError(err.message || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await telegramService.logout();
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h2>Chats</h2>
        </div>
        <div className="loading">Loading chats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h2>Chats</h2>
        </div>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h2>Chats</h2>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <div className="chat-items">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
            onClick={() => onChatSelect(chat.id, chat.title)}
          >
            <div className="chat-avatar">
              {chat.title.charAt(0).toUpperCase()}
            </div>
            <div className="chat-info">
              <div className="chat-header-row">
                <div className="chat-title">{chat.title}</div>
                <div className="chat-date">{formatDate(chat.lastMessageDate)}</div>
              </div>
              <div className="chat-last-message">
                {chat.lastMessage || 'No messages yet'}
              </div>
            </div>
            {chat.unreadCount > 0 && (
              <div className="chat-unread-badge">{chat.unreadCount}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
