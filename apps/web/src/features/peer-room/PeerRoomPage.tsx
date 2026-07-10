import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';
import {
  createRoom,
  getRoomByCode,
  joinRoom,
  endRoom,
  switchRole,
  type RoomParticipant,
} from '@/services/room.service';
import { useAuthStore } from '@/stores/authStore';
import { submitCode } from '@/services/code.service';
import {
  connectSocket,
  joinRoom as socketJoinRoom,
  leaveRoom as socketLeaveRoom,
  sendRoomMessage,
} from '@/services/socket';
import CodeEditor from './CodeEditor';
import Whiteboard from './Whiteboard';
import VideoCall from './VideoCall';

type RoomView = 'create' | 'lobby' | 'active' | 'ended';

export default function PeerRoomPage() {
  const { inviteCode: urlCode } = useParams<{ inviteCode?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [view, setView] = useState<RoomView>('create');
  const [roomId, setRoomId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<'editor' | 'whiteboard'>('editor');
  const [chatMessages, setChatMessages] = useState<{ id: string; content: string; displayName: string; timestamp: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [codeOutput, setCodeOutput] = useState<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [initialCode, setInitialCode] = useState('');
  const [initialLanguage, setInitialLanguage] = useState('javascript');
  const [initialWhiteboardState, setInitialWhiteboardState] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // If URL has an invite code, fetch room details
  useEffect(() => {
    if (urlCode && urlCode !== inviteCode) {
      handleLookupRoom(urlCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  // Socket.io lifecycle for active room
  useEffect(() => {
    if ((view === 'active' || view === 'lobby') && roomId) {
      const socket = connectSocket();
      socketJoinRoom(roomId, user?.name || 'User');

      socket.on('room:message', (msg) => {
        setChatMessages((prev) => [...prev, msg]);
      });

      socket.on('room:user-joined', (data) => {
        setChatMessages((prev) => [...prev, {
          id: `sys-${Date.now()}`,
          content: `${data.displayName} joined the room`,
          displayName: 'System',
          timestamp: new Date().toISOString(),
        }]);
        
        // If we are waiting in the lobby and someone joins, refresh the room to move to 'active' view
        if (view === 'lobby' && inviteCode) {
          handleLookupRoom(inviteCode);
        }
      });

      socket.on('room:user-left', (data) => {
        setChatMessages((prev) => [...prev, {
          id: `sys-${Date.now()}`,
          content: `${data.displayName} left the room`,
          displayName: 'System',
          timestamp: new Date().toISOString(),
        }]);
      });

      socket.on('room:ended', () => {
        setView('ended');
      });

      return () => {
        socketLeaveRoom(roomId);
        socket.off('room:message');
        socket.off('room:user-joined');
        socket.off('room:user-left');
        socket.off('room:ended');
      };
    }
  }, [view, roomId, user?.name, inviteCode]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createRoom();
      setRoomId(result.roomId);
      setInviteCode(result.inviteCode);
      setParticipants([
        { displayName: user?.name || 'You', role: 'interviewer', isGuest: false },
      ]);
      setView('lobby');
      navigate(`/peer-room/${result.inviteCode}`, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupRoom = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const room = await getRoomByCode(code.trim().toUpperCase());
      setRoomId(room.roomId);
      setInviteCode(room.inviteCode);
      setParticipants(room.participants);
      setInitialCode(room.code || '');
      setInitialLanguage(room.codeLanguage || 'javascript');
      setInitialWhiteboardState(room.whiteboardState || '');

      // Auto-join if not already in room
      const joinResult = await joinRoom(room.roomId);
      setParticipants(joinResult.participants);
      setView(joinResult.status === 'active' ? 'active' : 'lobby');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || (err instanceof Error ? err.message : 'Room not found'));
    } finally {
      setLoading(false);
    }
  };

  const handleEndRoom = async () => {
    setEnding(true);
    try {
      await endRoom(roomId);
      setView('ended');
    } catch {
      setEnding(false);
      setView('ended');
    }
  };

  const handleSwitchRole = useCallback(async () => {
    try {
      const result = await switchRole(roomId);
      setParticipants(result.participants);
    } catch {
      // ignore
    }
  }, [roomId]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendRoomMessage(roomId, chatInput.trim(), user?.name || 'User');
    setChatInput('');
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const handleRunCode = async (code: string, language: string) => {
    setIsRunning(true);
    setCodeOutput('> Sending to Judge0 servers...');
    
    try {
      const result = await submitCode(code, language);
      let out = `=== Status: ${result.status} ===\n`;
      if (result.time) out += `Time: ${result.time}s | Memory: ${result.memory}KB\n\n`;
      
      if (result.compileOutput) {
        out += `--- Compilation ---\n${result.compileOutput}\n\n`;
      }
      if (result.stderr) {
        out += `--- Error ---\n${result.stderr}\n\n`;
      }
      if (result.stdout) {
        out += `--- Output ---\n${result.stdout}\n`;
      }
      if (!result.stdout && !result.stderr && !result.compileOutput) {
        out += `(No output generated)`;
      }
      
      setCodeOutput(out);
    } catch (err: unknown) {
      setCodeOutput(`> Execution failed:\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const myRole = participants.find(
    (p) => !p.isGuest && p.displayName === (user?.name || ''),
  )?.role || 'candidate';

  // ===== CREATE VIEW =====
  if (view === 'create') {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-bg-base flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="text-display text-text-primary font-sans mb-2">Peer Interview Room</h1>
            <p className="text-body text-text-secondary font-sans">
              Practice with a partner — share code, whiteboard, and video in one tab.
            </p>
          </div>

          <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 mb-4">
            <h3 className="text-heading text-text-primary font-sans font-medium mb-4">
              Create a New Room
            </h3>
            <p className="text-body text-text-secondary font-sans mb-4">
              Create a room and share the invite code with your partner.
            </p>
            <Button onClick={handleCreateRoom} isLoading={loading} className="w-full">
              Create Room
            </Button>
          </div>

          <div className="relative flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-caption text-text-muted font-sans">OR</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          <div className="bg-bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-heading text-text-primary font-sans font-medium mb-4">
              Join with Code
            </h3>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="AB3K9X"
                maxLength={6}
                className="flex-1 bg-bg-elevated border border-border-default rounded-md px-4 py-2.5 font-mono text-code text-text-primary tracking-[0.2em] text-center uppercase focus:outline-none focus:border-accent-border placeholder:text-text-muted placeholder:tracking-[0.2em]"
              />
              <Button
                onClick={() => handleLookupRoom(joinCode)}
                isLoading={loading}
                disabled={joinCode.length < 6}
              >
                Join
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-caption text-danger font-sans mt-4 text-center">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ===== LOBBY VIEW (waiting for partner) =====
  if (view === 'lobby') {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-bg-base flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6 text-center">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="text-title text-text-primary font-sans mb-2">
              Waiting for Partner
            </h2>
            <p className="text-body text-text-secondary font-sans">
              Share the code below to invite your partner.
            </p>
          </div>

          {/* Invite Code Display */}
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 mb-6">
            <p className="text-caption text-text-muted font-sans uppercase tracking-[0.08em] mb-2">
              Room Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-[36px] font-mono font-semibold text-accent tracking-[0.3em]">
                {inviteCode}
              </span>
            </div>
            <div className="flex gap-2 mt-4 justify-center">
              <Button size="sm" variant="secondary" onClick={handleCopyCode}>
                {copied ? '✓ Copied' : 'Copy Code'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/room/${inviteCode}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                Copy Link
              </Button>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-4 mb-6">
            <p className="text-caption text-text-muted font-sans mb-3">
              Participants ({participants.length}/2)
            </p>
            <div className="flex flex-col gap-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-bg-overlay rounded-md">
                  <span className="text-body text-text-primary font-sans">{p.displayName}</span>
                  <span className="text-caption text-accent font-sans capitalize">{p.role}</span>
                </div>
              ))}
              {participants.length < 2 && (
                <div className="flex items-center justify-center px-3 py-2 border border-dashed border-border-subtle rounded-md">
                  <span className="text-caption text-text-muted font-sans">Waiting for partner...</span>
                </div>
              )}
            </div>
          </div>

          {/* Pulsing dot animation */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-caption text-text-muted font-sans">Listening for connections...</span>
          </div>
        </div>
      </div>
    );
  }

  // ===== ACTIVE VIEW (in session) =====
  if (view === 'active') {
    return (
      <div className="h-[calc(100vh-64px)] bg-bg-base flex flex-col">
        {/* Top Bar */}
        <div className="h-12 bg-bg-surface border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-body text-text-primary font-sans font-medium">Peer Room</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-overlay hover:bg-bg-elevated transition-colors"
            >
              <span className="font-mono text-caption text-accent">{inviteCode}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <span className={clsx(
              'px-2 py-0.5 rounded text-caption font-sans',
              myRole === 'interviewer'
                ? 'bg-accent/10 text-accent'
                : 'bg-[#7C3AED]/10 text-[#A78BFA]',
            )}>
              {myRole === 'interviewer' ? 'Interviewer' : 'Candidate'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleSwitchRole}>
              Switch Roles
            </Button>
            <Button size="sm" variant="danger" onClick={handleEndRoom} isLoading={ending}>
              End Room
            </Button>
          </div>
        </div>

        {/* Main Area — Three panels */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Left Panel — Video + Chat */}
          <div className="w-full md:w-[320px] bg-bg-surface border-b md:border-b-0 md:border-r border-border-subtle flex flex-col shrink-0 h-[380px] md:h-auto">
            {/* WebRTC Video */}
            <div className="p-3 border-b border-border-subtle">
              <VideoCall roomId={roomId} displayName={user?.name || 'User'} />
            </div>

            {/* Room Chat — Socket.io powered */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {chatMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-caption text-text-muted font-sans text-center">No messages yet</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={clsx(
                      'px-3 py-1.5 rounded-lg max-w-[90%]',
                      msg.displayName === 'System'
                        ? 'bg-transparent text-center w-full max-w-full'
                        : msg.displayName === (user?.name || '')
                          ? 'bg-accent/10 ml-auto'
                          : 'bg-bg-overlay',
                    )}>
                      {msg.displayName === 'System' ? (
                        <p className="text-[10px] text-text-muted font-sans italic">{msg.content}</p>
                      ) : (
                        <>
                          <p className="text-[10px] text-text-muted font-sans mb-0.5">{msg.displayName}</p>
                          <p className="text-caption text-text-primary font-sans">{msg.content}</p>
                        </>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-border-subtle p-3">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-caption font-sans text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted"
                  />
                  <Button size="sm" onClick={handleSendChat} disabled={!chatInput.trim()}>Send</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel — Code Editor / Whiteboard */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="h-10 bg-bg-surface border-b border-border-subtle flex items-center px-4 gap-1 shrink-0">
              <button
                onClick={() => setActivePanel('editor')}
                className={clsx(
                  'px-3 py-1.5 rounded text-caption font-sans transition-colors',
                  activePanel === 'editor' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary',
                )}
              >
                Code Editor
              </button>
              <button
                onClick={() => setActivePanel('whiteboard')}
                className={clsx(
                  'px-3 py-1.5 rounded text-caption font-sans transition-colors',
                  activePanel === 'whiteboard' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary',
                )}
              >
                Whiteboard
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <div className={clsx('absolute inset-0', activePanel === 'editor' ? 'flex flex-col' : 'hidden')}>
                <CodeEditor
                  roomId={roomId}
                  onRunCode={handleRunCode}
                  isRunning={isRunning}
                  output={codeOutput}
                  initialCode={initialCode}
                  initialLanguage={initialLanguage}
                />
              </div>
              <div className={clsx('absolute inset-0', activePanel === 'whiteboard' ? 'flex flex-col' : 'hidden')}>
                <Whiteboard roomId={roomId} initialState={initialWhiteboardState} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== ENDED VIEW =====
  return (
    <div className="min-h-[calc(100vh-64px)] bg-bg-base flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-title text-text-primary font-sans mb-2">Session Ended</h2>
        <p className="text-body text-text-secondary font-sans mb-6">
          Great practice session! Your progress has been recorded.
        </p>

        {/* Partner card */}
        {participants.length > 1 && (
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-4 mb-6">
            <p className="text-caption text-text-muted font-sans mb-2">Your Partner</p>
            <div className="flex items-center gap-3 justify-center">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-accent font-medium">
                  {participants[1].displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-body text-text-primary font-sans">
                {participants[1].displayName}
              </span>
            </div>
            <Button size="sm" variant="secondary" className="mt-3">
              Message {participants[1].displayName}
            </Button>
          </div>
        )}

        {/* Post-session rating */}
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-4 mb-6">
          <p className="text-body text-text-primary font-sans mb-3">Rate this session</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="w-10 h-10 rounded-lg border border-border-subtle hover:border-accent hover:bg-accent/10 transition-all flex items-center justify-center text-lg"
              >
                ⭐
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="ghost" onClick={() => navigate('/history')}>
            View History
          </Button>
          <Button onClick={() => { setView('create'); setRoomId(''); setInviteCode(''); setParticipants([]); navigate('/peer-room'); }}>
            New Room
          </Button>
        </div>
      </div>
    </div>
  );
}
