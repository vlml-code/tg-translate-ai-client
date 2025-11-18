import { useEffect, useState } from 'react';
import { ChatInfo } from '../types';
import { telegramService } from '../services/telegramClient';
import { databaseService, SavedChannel, ArchivedMessage, GeneratedDigest } from '../services/databaseService';
import { deepseekService, MessageForDigest } from '../services/deepseekService';
import { settingsService } from '../services/settingsService';
import { prepareDigestForTelegram } from '../services/telegramFormatter';
import './CompactChatsPage.css';

interface CompactChatsPageProps {
  onBack: () => void;
}

type ViewMode = 'manage' | 'monitor' | 'view' | 'digests';

export function CompactChatsPage({ onBack }: CompactChatsPageProps) {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [savedChannels, setSavedChannels] = useState<Map<string, SavedChannel>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('manage');

  // Monitor mode state
  const [monitorDate, setMonitorDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [monitoring, setMonitoring] = useState(false);
  const [monitorProgress, setMonitorProgress] = useState<string>('');

  // View mode state
  const [viewDate, setViewDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [archivedMessages, setArchivedMessages] = useState<ArchivedMessage[]>([]);
  const [archivedDates, setArchivedDates] = useState<Date[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Digests mode state
  const [digestDate, setDigestDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [generatedDigests, setGeneratedDigests] = useState<GeneratedDigest[]>([]);
  const [digestDates, setDigestDates] = useState<Date[]>([]);
  const [loadingDigests, setLoadingDigests] = useState(false);

  // Tag editing state
  const [editingTagForChannel, setEditingTagForChannel] = useState<string | null>(null);
  const [tempTag, setTempTag] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Starting to load data...');

      // Initialize database with timeout
      console.log('Initializing database...');
      try {
        await Promise.race([
          databaseService.initialize(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database initialization timeout')), 10000)
          )
        ]);
        console.log('Database initialized successfully');
      } catch (dbErr) {
        console.error('Database initialization failed:', dbErr);
        throw new Error(
          'Failed to initialize database. If the issue persists, please close all other tabs and refresh.'
        );
      }

      // Load chats from Telegram
      console.log('Loading chats from Telegram...');
      const chatList = await telegramService.getChats();
      console.log(`Loaded ${chatList.length} chats`);
      setChats(chatList);

      // Load saved channels from database
      console.log('Loading saved channels...');
      const saved = await databaseService.getAllChannels();
      const savedMap = new Map<string, SavedChannel>();
      saved.forEach((channel) => {
        savedMap.set(channel.id, channel);
      });
      setSavedChannels(savedMap);
      console.log(`Loaded ${saved.length} saved channels`);

      // Load archived dates
      console.log('Loading archived dates...');
      const dates = await databaseService.getArchivedDates();
      setArchivedDates(dates);
      console.log(`Loaded ${dates.length} archived dates`);

      // Load digest dates
      console.log('Loading digest dates...');
      const digestDatesData = await databaseService.getDigestDates();
      setDigestDates(digestDatesData);
      console.log(`Loaded ${digestDatesData.length} digest dates`);

      console.log('Data loading completed successfully');
    } catch (err) {
      console.error('Failed to load data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load chats and saved channels';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = async (chat: ChatInfo, checked: boolean) => {
    try {
      const existingChannel = savedChannels.get(chat.id);
      const savedChannel: SavedChannel = {
        id: chat.id,
        title: chat.title,
        isChecked: checked,
        tag: existingChannel?.tag,
        lastArchived: existingChannel?.lastArchived,
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

  const handleTagEdit = (channelId: string, currentTag?: string) => {
    setEditingTagForChannel(channelId);
    setTempTag(currentTag || '');
  };

  const handleTagSave = async (channelId: string) => {
    try {
      const existingChannel = savedChannels.get(channelId);
      if (!existingChannel) return;

      const updatedChannel: SavedChannel = {
        ...existingChannel,
        tag: tempTag.trim() || undefined,
      };

      await databaseService.saveChannel(updatedChannel);

      // Update local state
      const newSavedChannels = new Map(savedChannels);
      newSavedChannels.set(channelId, updatedChannel);
      setSavedChannels(newSavedChannels);

      setEditingTagForChannel(null);
      setTempTag('');
    } catch (err) {
      console.error('Failed to save tag:', err);
      setError('Failed to save tag');
    }
  };

  const handleTagCancel = () => {
    setEditingTagForChannel(null);
    setTempTag('');
  };

  const handleMonitorMessages = async () => {
    try {
      setMonitoring(true);
      setError('');
      setMonitorProgress('');

      const checkedChannels = Array.from(savedChannels.values()).filter(
        (ch) => ch.isChecked
      );

      if (checkedChannels.length === 0) {
        setError('No channels selected. Please check at least one channel.');
        setMonitoring(false);
        return;
      }

      const targetDate = new Date(monitorDate);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      let totalMessages = 0;
      let duplicatesSkipped = 0;

      // Step 1: Fetch and save messages
      for (let i = 0; i < checkedChannels.length; i++) {
        const channel = checkedChannels[i];
        setMonitorProgress(
          `Fetching messages from ${channel.title} (${i + 1}/${checkedChannels.length})...`
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
            // Check for duplicates and filter them out
            const newMessages: ArchivedMessage[] = [];
            for (const msg of messagesOnDate) {
              const exists = await databaseService.messageExists(channel.id, msg.id);
              if (!exists) {
                newMessages.push({
                  chatId: channel.id,
                  messageId: msg.id,
                  text: msg.text,
                  date: msg.date,
                  archivedDate: new Date(),
                  senderId: msg.senderId,
                  senderName: msg.senderName,
                  isOutgoing: msg.isOutgoing,
                });
              } else {
                duplicatesSkipped++;
              }
            }

            // Save only new messages to database
            if (newMessages.length > 0) {
              await databaseService.saveMessages(newMessages);
              totalMessages += newMessages.length;
            }

            // Update last monitored date
            await databaseService.updateChannelLastArchived(channel.id, new Date());
          }
        } catch (err) {
          console.error(`Failed to monitor messages from ${channel.title}:`, err);
          // Continue with other channels
        }
      }

      // Step 2: Generate digests per tag
      setMonitorProgress('Generating digests...');

      const settings = settingsService.getSettings();
      if (settings.deepseekApiKey) {
        try {
          // Get all messages for the target date
          const allMessages = await databaseService.getMessagesByDate(targetDate);

          // Group messages by tag
          const messagesByTag = new Map<string, ArchivedMessage[]>();

          for (const msg of allMessages) {
            const channel = savedChannels.get(msg.chatId);
            const tag = channel?.tag || 'untagged';

            if (!messagesByTag.has(tag)) {
              messagesByTag.set(tag, []);
            }
            messagesByTag.get(tag)!.push(msg);
          }

          // Generate digest for each tag
          let digestCount = 0;
          for (const [tag, messages] of messagesByTag.entries()) {
            if (messages.length === 0) continue;

            setMonitorProgress(`Generating digest for tag "${tag}" (${messages.length} messages)...`);

            try {
              // Prepare messages for DeepSeek
              const messagesForDigest: MessageForDigest[] = messages.map(msg => {
                const channel = savedChannels.get(msg.chatId);
                return {
                  text: msg.text,
                  date: new Date(msg.date),
                  senderName: msg.senderName,
                  channelTitle: channel?.title || msg.chatId
                };
              });

              // Generate digest using DeepSeek
              const digestText = await deepseekService.generateDigest(
                settings.deepseekApiKey,
                messagesForDigest,
                settings.digestPrompt,
                tag !== 'untagged' ? tag : undefined
              );

              // Save digest to database
              await databaseService.saveDigest({
                tag,
                date: targetDate,
                digest: digestText,
                generatedAt: new Date(),
                messageCount: messages.length
              });

              digestCount++;
            } catch (digestErr) {
              console.error(`Failed to generate digest for tag "${tag}":`, digestErr);
              // Continue with other tags
            }
          }

          setMonitorProgress(
            `✓ Generated ${digestCount} digests. Saved ${totalMessages} new messages (${duplicatesSkipped} duplicates skipped).`
          );

          // Step 3: Auto-send digests to configured channel if available
          if (settings.digestTargetChannelId && digestCount > 0) {
            try {
              setMonitorProgress('Sending digests to channel...');

              // Get the generated digests for this date
              const digestsToSend = await databaseService.getDigestsByDate(targetDate);

              for (let i = 0; i < digestsToSend.length; i++) {
                const digest = digestsToSend[i];
                setMonitorProgress(`Sending digest ${i + 1}/${digestsToSend.length} (${digest.tag})...`);

                try {
                  // Prepare digest for telegram (convert markdown, split if needed)
                  const messages = prepareDigestForTelegram(digest.digest, digest.tag);
                  console.log(`Sending ${messages.length} message(s) for tag "${digest.tag}"`);

                  // Send all messages for this digest
                  await telegramService.sendMessages(settings.digestTargetChannelId, messages);
                  console.log(`Successfully sent digest for tag "${digest.tag}"`);
                } catch (sendErr) {
                  console.error(`Failed to send digest for tag "${digest.tag}":`, sendErr);
                  throw sendErr; // Stop on first error
                }
              }

              setMonitorProgress(
                `✓ Completed! Saved ${totalMessages} messages, generated ${digestCount} digests, and sent them to channel.`
              );
            } catch (sendErr) {
              console.error('Failed to send digests to channel:', sendErr);
              setMonitorProgress(
                `✓ Generated ${digestCount} digests but failed to send to channel. Check settings.`
              );
            }
          } else {
            setMonitorProgress(
              `✓ Completed! Saved ${totalMessages} new messages, generated ${digestCount} digests.`
            );
          }
        } catch (digestErr) {
          console.error('Failed to generate digests:', digestErr);
          setMonitorProgress(
            `✓ Saved ${totalMessages} new messages (${duplicatesSkipped} duplicates skipped). Failed to generate digests.`
          );
        }
      } else {
        setMonitorProgress(
          `✓ Completed! Saved ${totalMessages} new messages (${duplicatesSkipped} duplicates skipped). No DeepSeek API key configured.`
        );
      }

      // Reload data to update UI
      await loadData();

      // Auto-switch to digests mode after a delay if digests were generated
      setTimeout(() => {
        if (settings.deepseekApiKey) {
          setViewMode('digests');
          setDigestDate(monitorDate);
        } else {
          setViewMode('view');
          setViewDate(monitorDate);
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to monitor messages:', err);
      setError('Failed to monitor messages. Please try again.');
    } finally {
      setMonitoring(false);
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

  const handleViewDigests = async () => {
    try {
      setLoadingDigests(true);
      setError('');

      const date = new Date(digestDate);
      const digests = await databaseService.getDigestsByDate(date);

      // Sort by tag
      digests.sort((a, b) => a.tag.localeCompare(b.tag));

      setGeneratedDigests(digests);
    } catch (err) {
      console.error('Failed to load digests:', err);
      setError('Failed to load digests');
    } finally {
      setLoadingDigests(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'view') {
      handleViewMessages();
    }
  }, [viewMode, viewDate]);

  useEffect(() => {
    if (viewMode === 'digests') {
      handleViewDigests();
    }
  }, [viewMode, digestDate]);

  const renderManageView = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>Manage Channels</h2>
        <p className="subtitle">Select channels to monitor for digest</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button
            onClick={() => loadData()}
            className="retry-btn"
            style={{ marginLeft: '10px', padding: '4px 12px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading channels...</div>
      ) : (
        <div className="compact-chat-list">
          {chats.map((chat) => {
            const saved = savedChannels.get(chat.id);
            const isChecked = saved?.isChecked || false;
            const lastArchived = saved?.lastArchived;
            const tag = saved?.tag;
            const isEditingTag = editingTagForChannel === chat.id;

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
                    <div className="chat-metadata">
                      {lastArchived && (
                        <span className="last-archived">
                          Last monitored: {new Date(lastArchived).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="chat-meta">
                    {chat.isChannel && <span className="badge">Channel</span>}
                    {chat.isGroup && <span className="badge">Group</span>}
                  </div>
                </label>
                <div className="tag-section" onClick={(e) => e.stopPropagation()}>
                  {isEditingTag ? (
                    <div className="tag-edit">
                      <input
                        type="text"
                        value={tempTag}
                        onChange={(e) => setTempTag(e.target.value)}
                        placeholder="Tag name"
                        className="tag-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTagSave(chat.id);
                          } else if (e.key === 'Escape') {
                            handleTagCancel();
                          }
                        }}
                      />
                      <button
                        onClick={() => handleTagSave(chat.id)}
                        className="tag-save-btn"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleTagCancel}
                        className="tag-cancel-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="tag-display">
                      {tag ? (
                        <span className="tag-badge" onClick={() => handleTagEdit(chat.id, tag)}>
                          {tag}
                        </span>
                      ) : (
                        <button
                          className="tag-add-btn"
                          onClick={() => handleTagEdit(chat.id)}
                          title="Add tag"
                        >
                          + Tag
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="action-buttons">
        <button onClick={() => setViewMode('monitor')} className="btn btn-primary">
          Monitor Messages →
        </button>
      </div>
    </div>
  );

  const renderMonitorView = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>Monitor Messages</h2>
        <p className="subtitle">Fetch and save messages from selected channels for digest</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="archive-controls">
        <div className="form-group">
          <label htmlFor="monitor-date">Select Date to Monitor:</label>
          <input
            type="date"
            id="monitor-date"
            value={monitorDate}
            onChange={(e) => setMonitorDate(e.target.value)}
            disabled={monitoring}
            className="date-input"
          />
        </div>

        <div className="selected-channels">
          <h3>Monitored Channels:</h3>
          <ul>
            {Array.from(savedChannels.values())
              .filter((ch) => ch.isChecked)
              .map((ch) => (
                <li key={ch.id}>
                  {ch.title}
                  {ch.tag && <span className="channel-tag-inline"> [{ch.tag}]</span>}
                </li>
              ))}
          </ul>
          {Array.from(savedChannels.values()).filter((ch) => ch.isChecked).length === 0 && (
            <p className="no-channels">No channels selected</p>
          )}
        </div>

        {monitorProgress && (
          <div className="archive-progress">{monitorProgress}</div>
        )}

        <div className="action-buttons">
          <button
            onClick={() => setViewMode('manage')}
            className="btn btn-secondary"
            disabled={monitoring}
          >
            ← Back to Manage
          </button>
          <button
            onClick={handleMonitorMessages}
            className="btn btn-primary"
            disabled={monitoring}
          >
            {monitoring ? 'Monitoring...' : 'Start Monitoring'}
          </button>
          <button
            onClick={() => setViewMode('view')}
            className="btn btn-secondary"
            disabled={monitoring}
          >
            View Saved →
          </button>
        </div>
      </div>
    </div>
  );

  const renderViewMode = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>View Digest Messages</h2>
        <p className="subtitle">Browse messages saved from monitored channels</p>
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
                  const savedChannel = savedChannels.get(msg.chatId);
                  return (
                    <div key={index} className="archived-message">
                      <div className="message-header">
                        <span className="channel-name">
                          {chat?.title || msg.chatId}
                          {savedChannel?.tag && (
                            <span className="message-tag"> [{savedChannel.tag}]</span>
                          )}
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
          <button onClick={() => setViewMode('monitor')} className="btn btn-secondary">
            Monitor More →
          </button>
        </div>
      </div>
    </div>
  );

  const renderDigestsView = () => (
    <div className="compact-chats-content">
      <div className="compact-chats-header">
        <h2>Generated Digests</h2>
        <p className="subtitle">View AI-generated digests organized by tag</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="view-controls">
        <div className="form-group">
          <label htmlFor="digest-date">Select Date:</label>
          <input
            type="date"
            id="digest-date"
            value={digestDate}
            onChange={(e) => setDigestDate(e.target.value)}
            className="date-input"
          />
        </div>

        {digestDates.length > 0 && (
          <div className="available-dates">
            <h3>Available Dates:</h3>
            <div className="date-pills">
              {digestDates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => setDigestDate(date.toISOString().split('T')[0])}
                  className={`date-pill ${
                    date.toISOString().split('T')[0] === digestDate ? 'active' : ''
                  }`}
                >
                  {date.toLocaleDateString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingDigests ? (
          <div className="loading-state">Loading digests...</div>
        ) : (
          <div className="digests-list">
            <h3>
              Digests for {new Date(digestDate).toLocaleDateString()} ({generatedDigests.length})
            </h3>
            {generatedDigests.length === 0 ? (
              <p className="no-messages">No digests found for this date</p>
            ) : (
              <div className="digests">
                {generatedDigests.map((digest, index) => (
                  <div key={index} className="digest-item">
                    <div className="digest-header">
                      <span className="digest-tag-badge">{digest.tag}</span>
                      <span className="digest-meta">
                        {digest.messageCount} messages • Generated{' '}
                        {new Date(digest.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="digest-content">{digest.digest}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="action-buttons">
          <button onClick={() => setViewMode('manage')} className="btn btn-secondary">
            ← Back to Manage
          </button>
          <button onClick={() => setViewMode('monitor')} className="btn btn-secondary">
            Monitor More →
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
        <h1>Digest Monitoring</h1>
        <div className="view-mode-tabs">
          <button
            onClick={() => setViewMode('manage')}
            className={`tab ${viewMode === 'manage' ? 'active' : ''}`}
          >
            Manage
          </button>
          <button
            onClick={() => setViewMode('monitor')}
            className={`tab ${viewMode === 'monitor' ? 'active' : ''}`}
          >
            Monitor
          </button>
          <button
            onClick={() => setViewMode('view')}
            className={`tab ${viewMode === 'view' ? 'active' : ''}`}
          >
            View
          </button>
          <button
            onClick={() => setViewMode('digests')}
            className={`tab ${viewMode === 'digests' ? 'active' : ''}`}
          >
            Digests
          </button>
        </div>
      </div>

      {viewMode === 'manage' && renderManageView()}
      {viewMode === 'monitor' && renderMonitorView()}
      {viewMode === 'view' && renderViewMode()}
      {viewMode === 'digests' && renderDigestsView()}
    </div>
  );
}
