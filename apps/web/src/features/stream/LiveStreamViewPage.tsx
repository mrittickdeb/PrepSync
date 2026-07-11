import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useChat,
  TrackToggle,
  DisconnectButton,
  useParticipants,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import { streamService, StreamInfo } from '@/services/stream.service';
import { getLiveKitToken } from '@/services/livekit.service';
import { useAuthStore } from '@/stores/authStore';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-server-url';

export default function LiveStreamViewPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (streamId) {
      fetchStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  const fetchStream = async () => {
    if (!streamId) return;
    try {
      setLoading(true);
      const data = await streamService.getStream(streamId);
      setStream(data);

      if (data.status === 'ended') {
        setEnded(true);
        return;
      }

      // Get LiveKit token for the room
      setTokenLoading(true);
      const { token: tk } = await getLiveKitToken(data.roomName);
      setToken(tk);
    } catch (error) {
      console.error('Error fetching stream:', error);
    } finally {
      setLoading(false);
      setTokenLoading(false);
    }
  };

  const handleEndStream = async () => {
    if (!stream) return;
    try {
      await streamService.endStream(stream._id);
      setEnded(true);
    } catch (error) {
      console.error('Error ending stream:', error);
    }
  };

  const isHost = stream && currentUser && (stream.host as any)._id === currentUser._id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!stream) {
    return (
      <PageWrapper>
        <div className="py-12 text-center flex flex-col gap-4 max-w-md mx-auto">
          <h2 className="text-display text-text-primary font-sans font-semibold">Stream Not Found</h2>
          <p className="text-body text-text-secondary font-sans leading-relaxed">
            This stream does not exist or has been removed.
          </p>
          <Link to="/community/live" className="text-accent font-sans font-medium hover:underline">
            ← Back to Live Streams
          </Link>
        </div>
      </PageWrapper>
    );
  }

  if (ended) {
    return (
      <PageWrapper>
        <div className="py-16 text-center flex flex-col gap-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-subtle mx-auto flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-display text-text-primary font-sans font-semibold">Stream Ended</h2>
          <p className="text-body text-text-secondary font-sans leading-relaxed">
            "{stream.title}" by {stream.host.name} has concluded.
          </p>
          <Link to="/community/live" className="text-accent font-sans font-medium hover:underline">
            ← Explore other live streams
          </Link>
        </div>
      </PageWrapper>
    );
  }

  if (tokenLoading || !token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base gap-4">
        <Spinner size="lg" />
        <p className="text-caption text-text-secondary font-sans">Connecting to stream...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-base overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/community/live')}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 bg-[#D32F2F] text-text-inverse px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Live
            </span>
            <h2 className="text-body text-text-primary font-sans font-bold truncate max-w-[300px]">
              {stream.title}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Avatar name={stream.host.name} imageUrl={stream.host.avatarUrl} size="sm" />
            <span className="text-caption text-text-primary font-sans font-semibold hidden md:inline">{stream.host.name}</span>
          </div>
          <span className="text-[10px] text-text-muted font-mono bg-bg-elevated px-2 py-1 rounded">
            {stream.viewers} viewers
          </span>
          {stream.category && stream.category !== 'General' && (
            <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded font-sans font-semibold hidden md:inline">
              {stream.category}
            </span>
          )}
          {isHost && (
            <button
              onClick={handleEndStream}
              className="px-4 py-1.5 bg-[#D32F2F] hover:bg-[#D32F2F]/90 text-text-inverse rounded-md text-[11px] font-sans font-semibold transition-colors cursor-pointer"
            >
              End Stream
            </button>
          )}
        </div>
      </div>

      {/* Main Content: LiveKit Room + Chat */}
      <LiveKitRoom
        token={token}
        serverUrl={LIVEKIT_URL}
        connect={true}
        audio={isHost ? true : false}
        video={isHost ? true : false}
        className="flex-1 flex overflow-hidden"
        onDisconnected={() => setEnded(true)}
      >
        <RoomAudioRenderer />
        <StreamContent isHost={!!isHost} streamTitle={stream.title} />
      </LiveKitRoom>
    </div>
  );
}

/* ─── Inner component: needs to be inside <LiveKitRoom> to use hooks ─── */
function StreamContent({ isHost, streamTitle }: { isHost: boolean; streamTitle: string }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const { chatMessages, send: sendChat } = useChat();
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  // Find the main video track (prefer screen share, fallback to camera)
  const screenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track
  );
  const cameraTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.publication?.track
  );
  const mainTrack = screenTrack || cameraTrack;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Video Area */}
      <div className="flex-1 flex flex-col bg-black relative">
        {mainTrack && mainTrack.publication?.track ? (
          <VideoTrack
            trackRef={mainTrack}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-20 h-20 rounded-full bg-bg-surface/10 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
                <polygon points="12 7 17 12 12 17 12 7" />
              </svg>
            </div>
            <p className="text-caption text-text-muted/70 font-sans">
              {isHost ? 'Your camera is off. Enable it or share your screen.' : 'Waiting for host to start streaming...'}
            </p>
          </div>
        )}

        {/* Host Controls Overlay */}
        {isHost && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-bg-surface/90 backdrop-blur-sm border border-border-subtle rounded-full px-5 py-2.5 shadow-lg">
            <TrackToggle
              source={Track.Source.Microphone}
              className="w-10 h-10 rounded-full bg-bg-elevated hover:bg-bg-overlay border border-border-subtle flex items-center justify-center text-text-primary transition-colors cursor-pointer"
            />
            <TrackToggle
              source={Track.Source.Camera}
              className="w-10 h-10 rounded-full bg-bg-elevated hover:bg-bg-overlay border border-border-subtle flex items-center justify-center text-text-primary transition-colors cursor-pointer"
            />
            <TrackToggle
              source={Track.Source.ScreenShare}
              className="w-10 h-10 rounded-full bg-bg-elevated hover:bg-bg-overlay border border-border-subtle flex items-center justify-center text-text-primary transition-colors cursor-pointer"
            />
            <DisconnectButton className="w-10 h-10 rounded-full bg-[#D32F2F] hover:bg-[#D32F2F]/80 flex items-center justify-center text-text-inverse transition-colors cursor-pointer" />
          </div>
        )}

        {/* Participant count badge */}
        <div className="absolute top-3 right-3 bg-black/70 px-2.5 py-1 rounded-full text-[10px] font-mono text-text-primary font-medium flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {participants.length}
        </div>
      </div>

      {/* Live Chat Sidebar */}
      <div className="w-80 border-l border-border-subtle bg-bg-surface flex flex-col shrink-0 hidden lg:flex">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h4 className="text-caption text-text-primary font-sans font-bold flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Live Chat
          </h4>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
          {chatMessages.length === 0 ? (
            <p className="text-[11px] text-text-muted font-sans italic text-center py-6">
              No messages yet. Say hi! 👋
            </p>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] text-accent font-sans font-bold">{msg.from?.name || 'Anon'}</span>
                  <span className="text-[9px] text-text-muted font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-caption text-text-primary font-sans leading-snug">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendChat} className="px-4 py-3 border-t border-border-subtle flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Say something..."
            className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="px-3 py-1.5 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-semibold hover:bg-accent/90 transition-colors cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
