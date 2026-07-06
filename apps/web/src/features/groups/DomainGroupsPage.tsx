import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';
import {
  listGroups,
  getGroupMessages,
  sendGroupMessage,
  sendFileMessage,
  sendVoiceMessage,
  createPoll,
  votePoll,
  type GroupInfo,
  type GroupMessageData,
  type AttachmentData,
} from '@/services/group.service';
import {
  uploadToCloudinary,
  getAttachmentType,
  validateFile,
  formatFileSize,
  FILE_ACCEPT,
} from '@/services/upload.service';
import { createDMThread } from '@/services/dm.service';
import { useAuthStore } from '@/stores/authStore';
import { connectSocket } from '@/services/socket';
import StudyLounge from './StudyLounge';
import GroupCall from './GroupCall';

const GROUP_COLORS: Record<string, string> = {
  dsa: '#7C3AED',
  'system-design': '#0EA5E9',
  backend: '#10B981',
  conceptual: '#F59E0B',
  behavioural: '#EC4899',
};

const GROUP_ICONS: Record<string, string> = {
  dsa: '🧮',
  'system-design': '🏗️',
  backend: '⚙️',
  conceptual: '📖',
  behavioural: '🗣️',
};

const DOC_ICONS: Record<string, string> = {
  pdf: '📕',
  doc: '📘',
  docx: '📘',
  xls: '📗',
  xlsx: '📗',
  ppt: '📙',
  pptx: '📙',
  txt: '📝',
  csv: '📊',
  zip: '📦',
  rar: '📦',
  '7z': '📦',
};

export default function DomainGroupsPage() {
  const { groupId } = useParams<{ groupId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(groupId || 'dsa');
  const [messages, setMessages] = useState<GroupMessageData[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [mainView, setMainView] = useState<'chat' | 'lounge' | 'call'>('chat');
  const [groupsPanelOpen, setGroupsPanelOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // File upload states
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ file: File; previewUrl: string; type: string } | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Fetch groups on mount and track resize
  useEffect(() => {
    fetchGroups();
    
    // Poll groups list every 5s for lastMessage preview updates
    const groupsInterval = setInterval(() => {
      listGroups().then((data) => setGroups(data.groups)).catch(() => {});
    }, 5000);

    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mainView !== 'call') {
        setGroupsPanelOpen(!mobile);
      }
    }
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(groupsInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, [mainView]);

  // Fetch messages + real-time socket + 3s polling fallback when active group changes
  useEffect(() => {
    if (!activeGroup) return;

    fetchMessages(activeGroup);

    // Auto-poll active group messages every 3s
    const msgInterval = setInterval(() => {
      fetchMessagesSilently(activeGroup);
    }, 3000);

    // Socket.io for instant real-time delivery
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      socket.emit('group:join', { groupId: activeGroup });

      socket.on('group:message', (newMsg: GroupMessageData) => {
        if (newMsg.groupId === activeGroup) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === newMsg._id)) return prev;
            return [...prev, newMsg];
          });
        }
      });
    } catch {
      // socket fallback to polling
    }

    return () => {
      clearInterval(msgInterval);
      if (socket) {
        socket.emit('group:leave', { groupId: activeGroup });
        socket.off('group:message');
      }
    };
  }, [activeGroup]);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Collapse panels when entering call
  useEffect(() => {
    if (mainView === 'call') {
      setGroupsPanelOpen(false);
      window.dispatchEvent(new CustomEvent('group-call-mode', { detail: { active: true } }));
    } else {
      setGroupsPanelOpen(true);
      window.dispatchEvent(new CustomEvent('group-call-mode', { detail: { active: false } }));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('group-call-mode', { detail: { active: false } }));
    };
  }, [mainView]);

  // Close attach menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    if (showAttachMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAttachMenu]);

  const fetchGroups = async () => {
    try {
      const data = await listGroups();
      setGroups(data.groups);
    } catch {
      // ignore
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchMessages = async (gId: string) => {
    setLoadingMessages(true);
    try {
      const data = await getGroupMessages(gId);
      setMessages(data.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchMessagesSilently = async (gId: string) => {
    try {
      const data = await getGroupMessages(gId);
      setMessages((prev) => {
        if (data.messages.length === prev.length) return prev;
        return data.messages;
      });
    } catch {
      // ignore
    }
  };

  // ── Send text message ──
  const handleSend = useCallback(async () => {
    if (!messageInput.trim() || sending) return;
    setSending(true);
    try {
      const newMsg = await sendGroupMessage(activeGroup, messageInput.trim());
      setMessages((prev) => [...prev, newMsg]);
      setMessageInput('');
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [activeGroup, messageInput, sending]);

  // ── File picker ──
  const openFilePicker = (acceptType: string) => {
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset for re-select

    const err = validateFile(file);
    if (err) {
      setUploadError(err);
      setTimeout(() => setUploadError(null), 4000);
      return;
    }

    const type = getAttachmentType(file);
    if (type === 'image' || type === 'video') {
      setPreviewFile({ file, previewUrl: URL.createObjectURL(file), type });
    } else {
      uploadAndSendFile(file);
    }
  };

  const cancelPreview = () => {
    if (previewFile) URL.revokeObjectURL(previewFile.previewUrl);
    setPreviewFile(null);
  };

  const confirmPreview = () => {
    if (previewFile) {
      uploadAndSendFile(previewFile.file);
      URL.revokeObjectURL(previewFile.previewUrl);
      setPreviewFile(null);
    }
  };

  const uploadAndSendFile = async (file: File) => {
    setSending(true);
    setUploadProgress(0);
    try {
      const result = await uploadToCloudinary(file, setUploadProgress);
      const attachment: AttachmentData = {
        type: getAttachmentType(file),
        url: result.url,
        filename: file.name,
        filesize: result.bytes,
        mimeType: file.type,
        duration: result.duration,
      };
      const newMsg = await sendFileMessage(activeGroup, [attachment], messageInput.trim() || undefined);
      setMessages((prev) => [...prev, newMsg]);
      setMessageInput('');
    } catch {
      setUploadError('Failed to upload file');
      setTimeout(() => setUploadError(null), 4000);
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return; // too short, discard

        setSending(true);
        setUploadProgress(0);
        try {
          const result = await uploadToCloudinary(blob, setUploadProgress, 'voice-message.webm');
          const attachment: AttachmentData = {
            type: 'voice',
            url: result.url,
            filename: 'Voice message',
            filesize: result.bytes,
            mimeType: 'audio/webm',
            duration: recordingDuration,
          };
          const newMsg = await sendVoiceMessage(activeGroup, attachment);
          setMessages((prev) => [...prev, newMsg]);
        } catch {
          setUploadError('Failed to send voice message');
          setTimeout(() => setUploadError(null), 4000);
        } finally {
          setSending(false);
          setUploadProgress(null);
          setRecordingDuration(0);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      setUploadError('Microphone access denied');
      setTimeout(() => setUploadError(null), 4000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    recordingChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Other handlers ──
  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    try {
      const newMsg = await createPoll(activeGroup, pollQuestion.trim(), validOptions);
      setMessages((prev) => [...prev, newMsg]);
      setShowPollForm(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch { /* ignore */ }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    try {
      await votePoll(activeGroup, pollId, optionIndex);
      fetchMessages(activeGroup);
    } catch { /* ignore */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGroupClick = (gId: string) => {
    setActiveGroup(gId);
    if (isMobile) {
      setGroupsPanelOpen(false);
    }
    if (mainView === 'call') return;
    setMainView('chat');
    navigate(`/groups/${gId}`, { replace: true });
  };

  const activeGroupInfo = groups.find((g) => g.groupId === activeGroup);
  const isCallMode = mainView === 'call';

  // ══════════════════════════════════════════════
  // RENDER HELPERS
  // ══════════════════════════════════════════════

  const renderAttachment = (att: AttachmentData, isMe: boolean) => {
    switch (att.type) {
      case 'image':
        return (
          <div className="dgp-media-image" onClick={() => setLightboxUrl(att.url)}>
            <img src={att.url} alt={att.filename} loading="lazy" />
          </div>
        );

      case 'video':
        return (
          <div className="dgp-media-video">
            <video controls preload="metadata" playsInline>
              <source src={att.url} type={att.mimeType || 'video/mp4'} />
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="dgp-media-audio">
            <div className="dgp-audio-icon">🎵</div>
            <div className="dgp-audio-body">
              <p className="dgp-audio-name">{att.filename}</p>
              <audio controls preload="metadata" style={{ width: '100%', height: 32 }}>
                <source src={att.url} type={att.mimeType || 'audio/mpeg'} />
              </audio>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className={clsx('dgp-media-voice', isMe && 'dgp-media-voice--me')}>
            <div className="dgp-voice-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </div>
            <div className="dgp-voice-body">
              <audio controls preload="metadata" style={{ width: '100%', height: 32 }}>
                <source src={att.url} type={att.mimeType || 'audio/webm'} />
              </audio>
              {att.duration != null && (
                <span className="dgp-voice-duration">{formatDuration(Math.round(att.duration))}</span>
              )}
            </div>
          </div>
        );

      case 'document':
      default: {
        const ext = att.filename.split('.').pop()?.toLowerCase() || '';
        const icon = DOC_ICONS[ext] || '📄';
        return (
          <a href={att.url} target="_blank" rel="noopener noreferrer" className={clsx('dgp-media-doc', isMe && 'dgp-media-doc--me')}>
            <span className="dgp-doc-icon">{icon}</span>
            <div className="dgp-doc-info">
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
      }
    }
  };

  // ══════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════

  return (
    <div className="dgp-container">
      {/* Mobile Backdrop */}
      {isMobile && groupsPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setGroupsPanelOpen(false)}
        />
      )}

      {/* ── Groups Panel ── */}
      <div className={clsx('dgp-groups-panel', !groupsPanelOpen && 'dgp-groups-panel--hidden', isMobile && 'dgp-groups-panel--mobile')}>
        <div className="dgp-groups-header">
          <h2 className="dgp-groups-title">Groups</h2>
          <button onClick={() => setGroupsPanelOpen(false)} className="dgp-icon-btn" title="Hide groups panel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <div className="dgp-groups-list">
          {groups.map((group) => (
            <button
              key={group.groupId}
              onClick={() => handleGroupClick(group.groupId)}
              className={clsx('dgp-group-item', activeGroup === group.groupId && 'dgp-group-item--active')}
            >
              {activeGroup === group.groupId && (
                <span className="dgp-group-indicator" style={{ backgroundColor: group.color }} />
              )}
              <div className="dgp-group-icon" style={{ backgroundColor: `${group.color}20` }}>
                <span>{GROUP_ICONS[group.groupId] || '💬'}</span>
              </div>
              <div className="dgp-group-info">
                <p className="dgp-group-name">{group.name}</p>
                {group.lastMessage && (
                  <p className="dgp-group-last-msg">
                    {group.lastMessage.senderName}: {group.lastMessage.content}
                  </p>
                )}
              </div>
            </button>
          ))}
          {loadingGroups && <div className="dgp-loading"><div className="dgp-spinner" /></div>}
        </div>
      </div>

      {/* ── Expand groups strip ── */}
      {!groupsPanelOpen && (
        <div className="dgp-expand-strip">
          <button onClick={() => setGroupsPanelOpen(true)} className="dgp-expand-btn" title="Show groups panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="dgp-main">
        {/* Header Bar */}
        <div className={clsx('dgp-header', isCallMode && 'dgp-header--call')}>
          <div className="dgp-header-left">
            <div className="dgp-header-icon" style={{ backgroundColor: `${GROUP_COLORS[activeGroup] || '#00D4FF'}20` }}>
              <span>{GROUP_ICONS[activeGroup] || '💬'}</span>
            </div>
            <div>
              <p className="dgp-header-name">{activeGroupInfo?.name || activeGroup}</p>
              <p className="dgp-header-meta">{activeGroupInfo?.totalMessages || 0} messages</p>
            </div>
          </div>
          <div className="dgp-header-tabs">
            <button className={clsx('dgp-tab', mainView === 'chat' && 'dgp-tab--active')} onClick={() => setMainView('chat')}>Chat</button>
            <button className={clsx('dgp-tab', mainView === 'lounge' && 'dgp-tab--active')} onClick={() => setMainView('lounge')}>Study Lounge</button>
            <button className={clsx('dgp-tab dgp-tab--call', mainView === 'call' && 'dgp-tab--active')} onClick={() => setMainView('call')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Group Call
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        {mainView === 'lounge' ? (
          <div className="dgp-content"><StudyLounge groupId={activeGroup} /></div>
        ) : mainView === 'call' ? (
          <div className="dgp-content dgp-content--call"><GroupCall roomName={`group-${activeGroup}`} /></div>
        ) : (
          <>
            {/* Messages */}
            <div className="dgp-messages">
              {loadingMessages ? (
                <div className="dgp-messages-empty"><div className="dgp-spinner" /></div>
              ) : messages.length === 0 ? (
                <div className="dgp-messages-empty">
                  <div className="dgp-messages-empty-inner">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="dgp-empty-title">No messages yet</p>
                    <p className="dgp-empty-subtitle">Be the first to start a conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.userId?._id === user?._id;
                  return (
                    <div key={msg._id} className={clsx('dgp-msg', isMe && 'dgp-msg--me')}>
                      {!isMe && (
                        <div className="dgp-msg-avatar" style={{ backgroundColor: `${GROUP_COLORS[activeGroup] || '#00D4FF'}15` }}>
                          <span className="dgp-msg-avatar-letter" style={{ color: GROUP_COLORS[activeGroup] }}>
                            {msg.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div className={clsx('dgp-msg-body', isMe && 'dgp-msg-body--me')}>
                        <div className={clsx('dgp-msg-meta', isMe && 'dgp-msg-meta--me')}>
                          <span
                            className={clsx('dgp-msg-name', isMe && 'dgp-msg-name--me', !isMe && 'cursor-pointer hover:underline')}
                            title={!isMe ? `DM ${msg.userId?.name}` : undefined}
                            onClick={async (e) => {
                              if (isMe || !msg.userId?._id) return;
                              e.stopPropagation();
                              try {
                                const { threadId } = await createDMThread(msg.userId._id);
                                navigate(`/dms/${threadId}`);
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            {isMe ? 'You' : (msg.userId?.name || 'Unknown')}
                          </span>
                          <span className="dgp-msg-time flex items-center gap-1">
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <span className="flex tracking-tighter ml-0.5 text-text-muted">
                                ✓
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Text */}
                        {msg.type === 'text' && <p className={clsx('dgp-msg-text', isMe && 'dgp-msg-text--me')}>{msg.content}</p>}

                        {/* Voice */}
                        {msg.type === 'voice' && msg.attachments?.map((att, i) => (
                          <div key={i}>{renderAttachment(att, isMe)}</div>
                        ))}

                        {/* File attachments */}
                        {msg.type === 'file' && (
                          <>
                            {msg.content && <p className={clsx('dgp-msg-text', isMe && 'dgp-msg-text--me')}>{msg.content}</p>}
                            {msg.attachments?.map((att, i) => (
                              <div key={i} style={{ marginTop: 6 }}>{renderAttachment(att, isMe)}</div>
                            ))}
                          </>
                        )}

                        {/* Poll */}
                        {msg.type === 'poll' && msg.poll && (
                          <div className="dgp-poll">
                            <p className="dgp-poll-question">📊 {msg.poll.question}</p>
                            <div className="dgp-poll-options">
                              {msg.poll.options.map((opt, idx) => {
                                const totalVotes = msg.poll!.options.reduce((sum, o) => sum + (o.voteCount || o.votes?.length || 0), 0);
                                const voteCount = opt.voteCount || opt.votes?.length || 0;
                                const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                return (
                                  <button key={idx} onClick={() => handleVote(msg._id, idx)} disabled={msg.poll!.closed} className="dgp-poll-option">
                                    <div className="dgp-poll-bar" style={{ width: `${pct}%`, backgroundColor: GROUP_COLORS[activeGroup] || '#00D4FF' }} />
                                    <span className="dgp-poll-option-text">{opt.text}</span>
                                    <span className="dgp-poll-option-count">{voteCount} ({pct}%)</span>
                                  </button>
                                );
                              })}
                            </div>
                            {msg.poll.closed && <p className="dgp-poll-closed">Poll closed</p>}
                          </div>
                        )}

                        {/* System */}
                        {msg.type === 'system' && <p className="dgp-msg-system">{msg.content}</p>}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Poll creation form */}
            {showPollForm && (
              <div className="dgp-poll-form">
                <div className="dgp-poll-form-inner">
                  <p className="dgp-poll-form-title">Create a Poll</p>
                  <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ask a question..." className="dgp-input" />
                  {pollOptions.map((opt, i) => (
                    <input key={i} value={opt} onChange={(e) => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }} placeholder={`Option ${i + 1}`} className="dgp-input dgp-input--option" />
                  ))}
                  <div className="dgp-poll-form-actions">
                    {pollOptions.length < 4 && <Button size="sm" variant="ghost" onClick={() => setPollOptions([...pollOptions, ''])}>+ Add Option</Button>}
                    <div style={{ flex: 1 }} />
                    <Button size="sm" variant="ghost" onClick={() => setShowPollForm(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreatePoll}>Create Poll</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Upload progress overlay */}
            {uploadProgress !== null && (
              <div className="dgp-upload-progress">
                <div className="dgp-upload-bar" style={{ width: `${uploadProgress}%` }} />
                <span className="dgp-upload-text">Uploading… {uploadProgress}%</span>
              </div>
            )}

            {/* Upload error */}
            {uploadError && (
              <div className="dgp-upload-error">
                <span>⚠️ {uploadError}</span>
              </div>
            )}

            {/* File preview overlay */}
            {previewFile && (
              <div className="dgp-preview-overlay">
                <div className="dgp-preview-content">
                  <div className="dgp-preview-header">
                    <span className="dgp-preview-title">Preview</span>
                    <button onClick={cancelPreview} className="dgp-icon-btn">✕</button>
                  </div>
                  <div className="dgp-preview-body">
                    {previewFile.type === 'image' ? (
                      <img src={previewFile.previewUrl} alt="Preview" />
                    ) : (
                      <video src={previewFile.previewUrl} controls />
                    )}
                  </div>
                  <div className="dgp-preview-footer">
                    <span className="dgp-preview-name">{previewFile.file.name}</span>
                    <span className="dgp-preview-size">{formatFileSize(previewFile.file.size)}</span>
                    <div style={{ flex: 1 }} />
                    <Button size="sm" variant="ghost" onClick={cancelPreview}>Cancel</Button>
                    <Button size="sm" onClick={confirmPreview}>Send</Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Rich Input Bar ── */}
            <div className="dgp-input-bar">
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" hidden onChange={handleFileSelected} />

              {isRecording ? (
                /* Recording UI */
                <div className="dgp-recording-bar">
                  <button onClick={cancelRecording} className="dgp-icon-btn dgp-recording-cancel" title="Cancel">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <div className="dgp-recording-indicator">
                    <span className="dgp-recording-dot" />
                    <span className="dgp-recording-time">{formatDuration(recordingDuration)}</span>
                    <span className="dgp-recording-label">Recording...</span>
                  </div>
                  <button onClick={stopRecording} className="dgp-recording-send" title="Send voice message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* Normal input UI */
                <>
                  {/* Attachment menu */}
                  <div className="dgp-attach-wrapper" ref={attachMenuRef}>
                    <button onClick={() => setShowAttachMenu(!showAttachMenu)} className="dgp-icon-btn" title="Attach file">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    {showAttachMenu && (
                      <div className="dgp-attach-menu">
                        <button onClick={() => openFilePicker(FILE_ACCEPT.image)} className="dgp-attach-option">
                          <span className="dgp-attach-icon" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' }}>📷</span>
                          <span>Image</span>
                        </button>
                        <button onClick={() => openFilePicker(FILE_ACCEPT.video)} className="dgp-attach-option">
                          <span className="dgp-attach-icon" style={{ backgroundColor: 'rgba(124,58,237,0.15)', color: '#7C3AED' }}>🎥</span>
                          <span>Video</span>
                        </button>
                        <button onClick={() => openFilePicker(FILE_ACCEPT.audio)} className="dgp-attach-option">
                          <span className="dgp-attach-icon" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>🎵</span>
                          <span>Audio</span>
                        </button>
                        <button onClick={() => openFilePicker(FILE_ACCEPT.document)} className="dgp-attach-option">
                          <span className="dgp-attach-icon" style={{ backgroundColor: 'rgba(14,165,233,0.15)', color: '#0EA5E9' }}>📄</span>
                          <span>Document</span>
                        </button>
                        <button onClick={() => { setShowAttachMenu(false); setShowPollForm(true); }} className="dgp-attach-option">
                          <span className="dgp-attach-icon" style={{ backgroundColor: 'rgba(236,72,153,0.15)', color: '#EC4899' }}>📊</span>
                          <span>Poll</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Text input */}
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="dgp-chat-input"
                    disabled={sending}
                  />

                  {/* Send or Voice button */}
                  {messageInput.trim() ? (
                    <Button size="sm" onClick={handleSend} disabled={sending}>Send</Button>
                  ) : (
                    <button onClick={startRecording} className="dgp-voice-btn" title="Record voice message" disabled={sending}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Image Lightbox ── */}
      {lightboxUrl && (
        <div className="dgp-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Full size" />
          <button className="dgp-lightbox-close">✕</button>
        </div>
      )}
    </div>
  );
}
