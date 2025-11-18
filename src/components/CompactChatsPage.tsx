import { useEffect, useState } from 'react';
import { ChatInfo } from '../types';
import { telegramService } from '../services/telegramClient';
import { databaseService, SavedChannel, ArchivedMessage } from '../services/databaseService';
import './CompactChatsPage.css';

interface CompactChatsPageProps {
  onBack: () => void;
}

type ViewMode = 'manage' | 'archive' | 'view';

export function CompactChatsPage({ onBack }: CompactChatsPageProps) {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [savedChannels, setSavedChannels] = useState<Map<string, SavedChannel>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('manage');

  // Archive mode state
  const [archiveDate, setArchiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [archiving, setArchiving] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<string>('');

  // View mode state
  const [viewDate, setViewDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [archivedMessages, setArchivedMessages] = useState<ArchivedMessage[]>([]);
  const [archivedDates, setArchivedDates] = useState<Date[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Initialize database
      await databaseService.initialize();

      // Load chats from Telegram
      const chatList = await telegramService.getChats();
      setChats(chatList);

      // Load saved channels from database
      const saved = await databaseService.getAllChannels();
      const savedMap = new Map<string, SavedChannel>();
      saved.forEach((channel) => {
        savedMap.set(channel.id, channel);
      });
      setSavedChannels(savedMap);

      // Load archived dates
      const dates = await databaseService.getArchivedDates();
      setArchivedDates(dates);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load chats and saved channels');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = async (chat: ChatInfo, checked: boolean) => {
    try {
      const savedChannel: SavedChannel = {
        id: chat.id,
        title: chat.title,
        isChecked: checked,
        lastArchived: savedChannels.get(chat.id)?.lastArchived,
      };

      await databaseService.saveChannel(savedChannel);

      // Update local state
      const newSavedChannels = new Map(savedChannels);
      newSavedChannels.set(chat.id, savedChannel);
      setSavedChannels(newSavedChannels);
    } catch (err) {
      console.error('Failed to save channel:', err);
      setError(`Failed to save channel: ${chat.title}`);
    }
  };

  const handleArchiveMessages = async () => {
    try {
      setArchiving(true);
      setError('');
      setArchiveProgress('');

      const checkedChannels = Array.from(savedChannels.values()).filter(
        (ch) => ch.isChecked
      );

      if (checkedChannels.length === 0) {
        setError('No channels selected. Please check at least one channel.');
        setArchiving(false);
        return;
      }

      const targetDate = new Date(archiveDate);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      let totalMessages = 0;

      for (let i = 0; i < checkedChannels.length; i++) {
        const channel = checkedChannels[i];
        setArchiveProgress(
          `Processing ${channel.title} (${i + 1}/${checkedChannels.length})...`
        );

        try {
          // Fetch messages from this channel
          const messages = await telegramService.getMessages(channel.id, 100);

          // Filter messages by date
          const messagesOnDate = messages.filter((msg: any) => {
            const msgDate = new Date(msg.date);
            return msgDate >= startOfDay && msgDate <= endOfDay;
          });

          if (messagesOnDate.length > 0) {
            // Convert to archived messages
            const archivedMessages: ArchivedMessage[] = messagesOnDate.map((msg: any) => ({
              chatId: channel.id,
              messageId: msg.id,
              text: msg.text,
              date: msg.date,
              archivedDate: new Date(),
              senderId: msg.senderId,
              senderName: msg.senderName,
              isOutgoing: msg.isOutgoing,
            }));

            // Save to database
            await databaseService.saveMessages(archivedMessages);
            totalMessages += archivedMessages.length;

            // Update last archived date
            await databaseService.updateChannelLastArchived(channel.id, new Date());
          }
        } catch (err) {
          console.error(`Failed to archive messages from ${channel.title}:`, err);
          // Continue with other channels
        }
      }

      setArchiveProgress(
        `✓ Completed! Archived ${totalMessages} messages from ${checkedChannels.length} channels.`
      );

      // Reload data to update UI
      await loadData();

      // Auto-switch to view mode after a delay
      setTimeout(() => {
        setViewMode('view');
        setViewDate(archiveDate);
      }, 2000);
    } catch (err) {
      console.error('Failed to archive messages:', err);
      setError('Failed to archive messages. Please try again.');
    } finally {
      setArchiving(false);
    }
  };

  const handleViewMessages = async () => {
    try {
      setLoadingMessages(true);
      setError('');

      const date = new Date(viewDate);
      const messages = await databaseService.getMessagesByDate(date);

      // Sort by date (newest first)
      messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setArchivedMessages(messages);
    } catch (err) {
      console.error('Failed to load archived messages:', err);
      setError('Failed to load archived messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'view') {
      handleViewMessages();
    }
  }, [viewMode, viewDate]);

  const renderManageView = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>Manage Channels</h2>
        <p className="subtitle">Select channels to archive messages from</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading channels...</div>
      ) : (
        <div className="compact-chat-list">
          {chats.map((chat) => {
            const saved = savedChannels.get(chat.id);
            const isChecked = saved?.isChecked || false;
            const lastArchived = saved?.lastArchived;

            return (
              <div key={chat.id} className="compact-chat-item">
                <input
                  type="checkbox"
                  id={`chat-${chat.id}`}
                  checked={isChecked}
                  onChange={(e) => handleCheckboxChange(chat, e.target.checked)}
                  className="chat-checkbox"
                />
                <label htmlFor={`chat-${chat.id}`} className="chat-label">
                  <div className="chat-info">
                    <span className="chat-title">{chat.title}</span>
                    {lastArchived && (
                      <span className="last-archived">
                        Last archived: {new Date(lastArchived).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="chat-meta">
                    {chat.isChannel && <span className="badge">Channel</span>}
                    {chat.isGroup && <span className="badge">Group</span>}
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      )}

      <div className="action-buttons">
        <button onClick={() => setViewMode('archive')} className="btn btn-primary">
          Archive Messages →
        </button>
      </div>
    </div>
  );

  const renderArchiveView = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>Archive Messages</h2>
        <p className="subtitle">Fetch and save messages from selected channels</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="archive-controls">
        <div className="form-group">
          <label htmlFor="archive-date">Select Date to Archive:</label>
          <input
            type="date"
            id="archive-date"
            value={archiveDate}
            onChange={(e) => setArchiveDate(e.target.value)}
            disabled={archiving}
            className="date-input"
          />
        </div>

        <div className="selected-channels">
          <h3>Selected Channels:</h3>
          <ul>
            {Array.from(savedChannels.values())
              .filter((ch) => ch.isChecked)
              .map((ch) => (
                <li key={ch.id}>{ch.title}</li>
              ))}
          </ul>
          {Array.from(savedChannels.values()).filter((ch) => ch.isChecked).length === 0 && (
            <p className="no-channels">No channels selected</p>
          )}
        </div>

        {archiveProgress && (
          <div className="archive-progress">{archiveProgress}</div>
        )}

        <div className="action-buttons">
          <button
            onClick={() => setViewMode('manage')}
            className="btn btn-secondary"
            disabled={archiving}
          >
            ← Back to Manage
          </button>
          <button
            onClick={handleArchiveMessages}
            className="btn btn-primary"
            disabled={archiving}
          >
            {archiving ? 'Archiving...' : 'Start Archiving'}
          </button>
          <button
            onClick={() => setViewMode('view')}
            className="btn btn-secondary"
            disabled={archiving}
          >
            View Archived →
          </button>
        </div>
      </div>
    </div>
  );

  const renderViewMode = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>View Archived Messages</h2>
        <p className="subtitle">Browse messages saved to the database</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="view-controls">
        <div className="form-group">
          <label htmlFor="view-date">Select Date:</label>
          <input
            type="date"
            id="view-date"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
            className="date-input"
          />
        </div>

        {archivedDates.length > 0 && (
          <div className="available-dates">
            <h3>Available Dates:</h3>
            <div className="date-pills">
              {archivedDates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => setViewDate(date.toISOString().split('T')[0])}
                  className={`date-pill ${
                    date.toISOString().split('T')[0] === viewDate ? 'active' : ''
                  }`}
                >
                  {date.toLocaleDateString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingMessages ? (
          <div className="loading-state">Loading messages...</div>
        ) : (
          <div className="archived-messages-list">
            <h3>
              Messages for {new Date(viewDate).toLocaleDateString()} ({archivedMessages.length})
            </h3>
            {archivedMessages.length === 0 ? (
              <p className="no-messages">No messages found for this date</p>
            ) : (
              <div className="messages">
                {archivedMessages.map((msg, index) => {
                  const chat = chats.find((c) => c.id === msg.chatId);
                  return (
                    <div key={index} className="archived-message">
                      <div className="message-header">
                        <span className="channel-name">
                          {chat?.title || msg.chatId}
                        </span>
                        <span className="message-time">
                          {new Date(msg.date).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="message-sender">
                        {msg.isOutgoing ? 'You' : msg.senderName}
                      </div>
                      <div className="message-text">{msg.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="action-buttons">
          <button onClick={() => setViewMode('manage')} className="btn btn-secondary">
            ← Back to Manage
          </button>
          <button onClick={() => setViewMode('archive')} className="btn btn-secondary">
            Archive More →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="compact-chats-page">
      <div className="page-header">
        <button onClick={onBack} className="back-button">
          ← Back to Chats
        </button>
        <h1>Channel Archive Manager</h1>
        <div className="view-mode-tabs">
          <button
            onClick={() => setViewMode('manage')}
            className={`tab ${viewMode === 'manage' ? 'active' : ''}`}
          >
            Manage
          </button>
          <button
            onClick={() => setViewMode('archive')}
            className={`tab ${viewMode === 'archive' ? 'active' : ''}`}
          >
            Archive
          </button>
          <button
            onClick={() => setViewMode('view')}
            className={`tab ${viewMode === 'view' ? 'active' : ''}`}
          >
            View
          </button>
        </div>
      </div>

      {viewMode === 'manage' && renderManageView()}
      {viewMode === 'archive' && renderArchiveView()}
      {viewMode === 'view' && renderViewMode()}
    </div>
  );
}
