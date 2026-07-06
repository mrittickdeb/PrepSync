import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';
import {
  listDMThreads,
  getDMMessages,
  sendDMMessage,
  type DMThreadData,
  type DMMessageData,
} from '@/services/dm.service';
import { createRoom } from '@/services/room.service';
import { uploadFile, getFileDownloadUrl } from '@/services/upload.service';
import { useAuthStore } from '@/stores/authStore';
import { connectSocket } from '@/services/socket';

export default function DMsPage() {
  const { threadId: activeThreadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [threads, setThreads] = useState<DMThreadData[]>([]);
  const [messages, setMessages] = useState<DMMessageData[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [threadsPanelOpen, setThreadsPanelOpen] = useState(window.innerWidth >= 768 || !activeThreadId);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreads();
    
    // Auto-poll threads list every 4 seconds
    const threadInterval = setInterval(() => {
      fetchThreadsSilently();
    }, 4000);

    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setThreadsPanelOpen(true);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(threadInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;

    fetchMessages(activeThreadId);

    // Auto-poll active thread messages every 3 seconds
    const msgInterval = setInterval(() => {
      fetchMessagesSilently(activeThreadId);
    }, 3000);

    // Connect socket for instant real-time delivery
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      socket.emit('dm:join', { threadId: activeThreadId });

      socket.on('dm:message', (newMsg: DMMessageData) => {
        if (newMsg.threadId === activeThreadId) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === newMsg._id)) return prev;
            return [...prev, newMsg];
          });
          fetchThreadsSilently();
        }
      });
    } catch {
      // socket fallback to polling
    }

    return () => {
      clearInterval(msgInterval);
      if (socket) {
        socket.emit('dm:leave', { threadId: activeThreadId });
        socket.off('dm:message');
      }
    };
  }, [activeThreadId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchThreads = async () => {
    try {
      const data = await listDMThreads();
      setThreads(data.threads);
    } catch {
      // ignore
    } finally {
      setLoadingThreads(false);
    }
  };

  const fetchThreadsSilently = async () => {
    try {
      const data = await listDMThreads();
      setThreads(data.threads);
    } catch {
      // ignore
    }
  };

  const fetchMessages = async (tId: string) => {
    setLoadingMessages(true);
    try {
      const data = await getDMMessages(tId);
      setMessages(data.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchMessagesSilently = async (tId: string) => {
    try {
      const data = await getDMMessages(tId);
      setMessages((prev) => {
        if (data.messages.length === prev.length) return prev;
        return data.messages;
      });
    } catch {
      // ignore
    }
  };

  const handleSend = useCallback(async () => {
    if (!messageInput.trim() || sending || !activeThreadId) return;
    setSending(true);
    try {
      const newMsg = await sendDMMessage(activeThreadId, messageInput.trim());
      setMessages((prev) => [...prev, newMsg]);
      setMessageInput('');
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [activeThreadId, messageInput, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeThread = threads.find((t) => t.threadId === activeThreadId);

  const handleStartPeerRoom = async () => {
    if (!activeThreadId || creatingRoom) return;
    setCreatingRoom(true);
    try {
      const room = await createRoom();
      // Send the invite link as a DM so the partner can join
      const inviteLink = `${window.location.origin}/room/${room.inviteCode}`;
      await sendDMMessage(
        activeThreadId,
        `🎯 I've created a Peer Room! Join here: ${inviteLink} (Code: ${room.inviteCode})`,
      );
      // Refresh messages to show the invite
      await fetchMessages(activeThreadId);
      // Navigate to the room
      navigate('/peer-room');
    } catch {
      // ignore
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeThreadId || uploading) return;
    setUploading(true);
    try {
      const result = await uploadFile(file, 'prepsync/dms');
      const attachmentType = file.type.startsWith('image/') ? 'image' : 'file';
      
      const newMsg = await sendDMMessage(activeThreadId, `File Shared: ${file.name}`, [
        {
          url: result.url,
          filename: result.filename,
          filesize: result.filesize,
          type: attachmentType,
        },
      ]);
      setMessages((prev) => [...prev, newMsg]);
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] md:h-[calc(100vh-48px)] flex relative overflow-hidden">
      {/* Mobile Backdrop */}
      {isMobile && threadsPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setThreadsPanelOpen(false)}
        />
      )}

      {/* Thread List */}
      <div className={clsx(
        "bg-bg-surface border-r border-border-subtle flex flex-col shrink-0 transition-transform duration-200 z-30",
        isMobile ? "absolute inset-y-0 left-0 w-[280px]" : "w-[300px]",
        isMobile && !threadsPanelOpen && "-translate-x-full"
      )}>
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-heading text-text-primary font-sans font-semibold">Messages</h2>
          {isMobile && (
            <button onClick={() => setThreadsPanelOpen(false)} className="p-1 text-text-muted hover:text-text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="p-4 text-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-body text-text-muted font-sans">No conversations yet</p>
              <p className="text-caption text-text-muted font-sans mt-1">
                Start a conversation from someone's profile
              </p>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.threadId}
                onClick={() => {
                  if (isMobile) setThreadsPanelOpen(false);
                  navigate(`/dms/${thread.threadId}`);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left relative',
                  activeThreadId === thread.threadId
                    ? 'bg-bg-overlay'
                    : 'hover:bg-bg-overlay/50',
                )}
              >
                {activeThreadId === thread.threadId && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-accent rounded-r-sm" />
                )}
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-sm text-accent font-medium">
                    {thread.partner?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text-primary font-sans truncate">
                    {thread.partner?.name || 'Unknown'}
                  </p>
                  <p className="text-caption text-text-muted font-sans truncate">
                    {thread.lastMessagePreview || 'No messages yet'}
                  </p>
                </div>
                <span className="text-[10px] text-text-muted font-sans shrink-0">
                  {new Date(thread.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeThreadId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <p className="text-body text-text-secondary font-sans">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-14 bg-bg-surface border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <button onClick={() => setThreadsPanelOpen(true)} className="p-1 -ml-2 text-text-muted hover:text-text-primary rounded-md hover:bg-bg-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                )}
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-sm text-accent font-medium">
                    {activeThread?.partner?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <p className="text-body text-text-primary font-sans font-medium">
                  {activeThread?.partner?.name || 'Unknown'}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleStartPeerRoom} isLoading={creatingRoom}>
                Start Peer Room
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-body text-text-muted font-sans">No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId?._id === user?._id;
                  return (
                    <div
                      key={msg._id}
                      className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={clsx(
                          'max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl',
                          isMe
                            ? 'bg-accent text-text-inverse rounded-br-md'
                            : 'bg-bg-surface border border-border-subtle text-text-primary rounded-bl-md',
                        )}
                      >
                        <p className="text-body font-sans whitespace-pre-wrap">{msg.content}</p>

                        {/* File attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {msg.attachments.map((att, idx) => (
                              <a
                                key={idx}
                                href={getFileDownloadUrl(att.url, att.filename)}
                                download={att.filename}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={clsx(
                                  'flex items-center gap-2 p-2 rounded-md transition-colors text-sm font-sans',
                                  isMe ? 'bg-black/20 hover:bg-black/30 text-white' : 'bg-bg-overlay hover:bg-bg-elevated text-text-primary'
                                )}
                              >
                                <span>{att.type === 'image' ? '🖼️' : '📄'}</span>
                                <span className="truncate">{att.filename}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        <p className={clsx(
                          'text-[10px] mt-1',
                          isMe ? 'text-text-inverse/60' : 'text-text-muted',
                        )}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="bg-bg-surface border-t border-border-subtle p-3">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors shrink-0"
                  title="Attach file"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                  ) : (
                    '📎'
                  )}
                </button>
                <input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-bg-base border border-border-subtle rounded-full px-4 py-2.5 text-body font-sans text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
                />
                <Button size="sm" onClick={handleSend} disabled={!messageInput.trim() || sending}>
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
