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
import { uploadFile, formatFileSize } from '@/services/upload.service';
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [threadsPanelOpen, setThreadsPanelOpen] = useState(window.innerWidth >= 768 || !activeThreadId);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  useEffect(() => {
    fetchThreads();
    
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setThreadsPanelOpen(true);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;

    fetchMessages(activeThreadId);

    // Connect socket for instant real-time delivery
    try {
      const socket = connectSocket();
      socketRef.current = socket;
      socket.emit('dm:join', { threadId: activeThreadId });
      
      if (user?._id) {
        socket.emit('dm:mark_read', { threadId: activeThreadId, userId: user._id });
      }

      socket.on('dm:message', (newMsg: DMMessageData) => {
        if (newMsg.threadId === activeThreadId) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === newMsg._id)) return prev;
            return [...prev, newMsg];
          });
          fetchThreadsSilently();
          if (newMsg.senderId._id !== user?._id && user?._id) {
            socket.emit('dm:mark_read', { threadId: activeThreadId, userId: user._id });
          }
        }
      });
      
      socket.on('dm:read', (data: { threadId: string, userId: string }) => {
        if (data.threadId === activeThreadId) {
          setMessages((prev) => prev.map((m) => {
            const readBy = m.readBy || [];
            if (!readBy.includes(data.userId)) {
               return { ...m, readBy: [...readBy, data.userId] };
            }
            return m;
          }));
        }
      });
    } catch {
      // socket fallback to polling
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('dm:leave', { threadId: activeThreadId });
        socketRef.current.off('dm:message');
        socketRef.current.off('dm:read');
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
      if (user?._id) {
        socketRef.current?.emit('dm:mark_read', { threadId: tId, userId: user._id });
      }
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

    // Validate that the file is either an image or a PDF
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      alert('Only image and PDF files are supported in direct messages.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(file, 'prepsync/dms');
      const attachmentType: 'image' | 'pdf' = isImage ? 'image' : 'pdf';
      
      const newMsg = await sendDMMessage(activeThreadId, `File Shared: ${file.name}`, [
        {
          url: result.url,
          filename: result.filename,
          filesize: result.filesize,
          type: attachmentType,
        },
      ]);
      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      console.error('File upload/send failed:', err);
      alert('Failed to send file. Please try again.');
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
            <div className="dgp-messages flex-1">
              {loadingMessages ? (
                <div className="dgp-messages-empty"><div className="dgp-spinner" /></div>
              ) : messages.length === 0 ? (
                <div className="dgp-messages-empty">
                  <div className="dgp-messages-empty-inner">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="dgp-empty-title">No messages yet. Say hello! 👋</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId?._id === user?._id;
                  return (
                    <div key={msg._id} className={clsx('dgp-msg', isMe && 'dgp-msg--me')}>
                      {!isMe && (
                        <div className="dgp-msg-avatar" style={{ backgroundColor: `#00D4FF15` }}>
                          <span className="dgp-msg-avatar-letter" style={{ color: '#00D4FF' }}>
                            {msg.senderId?.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      
                      <div className={clsx('dgp-msg-body', isMe && 'dgp-msg-body--me')}>
                        <div className={clsx('dgp-msg-meta', isMe && 'dgp-msg-meta--me')}>
                          <span className={clsx('dgp-msg-name', isMe && 'dgp-msg-name--me')}>
                            {isMe ? 'You' : (msg.senderId?.name || 'Unknown')}
                          </span>
                          <span className="dgp-msg-time flex items-center gap-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isMe && (
                              <span className={clsx("flex tracking-tighter", (msg.readBy?.some(id => id !== user?._id)) ? 'text-[#00D4FF]' : 'text-text-muted')}>
                                {(msg.readBy?.some(id => id !== user?._id)) ? '✓✓' : '✓'}
                              </span>
                            )}
                          </span>
                        </div>

                        <p className={clsx('dgp-msg-text', isMe && 'dgp-msg-text--me')}>{msg.content}</p>

                        {/* File attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
                            {msg.attachments.map((att, idx) => {
                              const isImage = att.type === 'image';
                              return isImage ? (
                                <div 
                                  key={idx} 
                                  className="dgp-media-image mt-1" 
                                  onClick={() => setLightboxUrl(att.url)}
                                >
                                  <img src={att.url} alt={att.filename} loading="lazy" />
                                </div>
                              ) : (
                                <a 
                                  key={idx} 
                                  href={att.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className={clsx('dgp-media-doc mt-1', isMe && 'dgp-media-doc--me')}
                                >
                                  <span className="dgp-doc-icon">📕</span>
                                  <div className="dgp-doc-info text-left">
                                    <p className="dgp-doc-name">{att.filename}</p>
                                    <p className="dgp-doc-size">{formatFileSize(att.filesize)}</p>
                                  </div>
                                  <span className="dgp-doc-download">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                      <polyline points="7 10 12 15 17 10" />
                                      <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        )}
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
                  accept="image/*,.pdf"
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
      {/* ── Image Lightbox ── */}
      {lightboxUrl && (
        <div className="dgp-lightbox z-[100]" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Full size" />
          <button className="dgp-lightbox-close">✕</button>
        </div>
      )}
    </div>
  );
}
