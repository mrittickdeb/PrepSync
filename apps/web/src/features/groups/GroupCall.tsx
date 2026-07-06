import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ParticipantTile,
  useTracks,
  useChat,
  TrackToggle,
  DisconnectButton,
  useParticipants,
  TrackRefContext,
  isTrackReference,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { getLiveKitToken } from '@/services/livekit.service';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-server-url';

interface GroupCallProps {
  roomName: string;
}

/* ─── Pin Context ─── */
type PinContextType = {
  pinnedTrack: TrackReferenceOrPlaceholder | null;
  pin: (track: TrackReferenceOrPlaceholder) => void;
  unpin: () => void;
};
const PinContext = createContext<PinContextType>({
  pinnedTrack: null,
  pin: () => {},
  unpin: () => {},
});

/* ─── Pin Button Overlay ─── */
function PinOverlay({ track }: { track: TrackReferenceOrPlaceholder }) {
  const { pinnedTrack, pin, unpin } = useContext(PinContext);

  const isPinned =
    pinnedTrack &&
    isTrackReference(pinnedTrack) &&
    isTrackReference(track) &&
    pinnedTrack.publication?.trackSid === track.publication?.trackSid;

  const participantName =
    track.participant?.name || track.participant?.identity || 'Unknown';
  const isScreenShare = track.source === Track.Source.ScreenShare;

  return (
    <div className="gc-pin-overlay">
      <button
        className={`gc-pin-btn ${isPinned ? 'gc-pin-btn--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isPinned) {
            unpin();
          } else {
            pin(track);
          }
        }}
        title={isPinned ? 'Unpin' : `Pin ${isScreenShare ? 'screen share' : participantName}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Custom Participant Tile with Pin ─── */
function PinnableParticipantTile({ track }: { track: TrackReferenceOrPlaceholder }) {
  return (
    <div className="gc-pinnable-tile">
      <TrackRefContext.Provider value={track}>
        <ParticipantTile />
      </TrackRefContext.Provider>
      <PinOverlay track={track} />
    </div>
  );
}

/* ─── Grid View (no pin active) ─── */
function GridView({ tracks }: { tracks: TrackReferenceOrPlaceholder[] }) {
  return (
    <div className="gc-grid-view">
      {tracks.map((track, i) => (
        <PinnableParticipantTile key={`${track.participant?.sid}-${track.source}-${i}`} track={track} />
      ))}
    </div>
  );
}

/* ─── Spotlight View (someone pinned) ─── */
function SpotlightView({
  pinnedTrack,
  otherTracks,
}: {
  pinnedTrack: TrackReferenceOrPlaceholder;
  otherTracks: TrackReferenceOrPlaceholder[];
}) {
  const { unpin } = useContext(PinContext);

  return (
    <div className="gc-spotlight-layout">
      {/* Main pinned view */}
      <div className="gc-spotlight-main">
        <div className="gc-pinnable-tile gc-spotlight-tile">
          <TrackRefContext.Provider value={pinnedTrack}>
            <ParticipantTile />
          </TrackRefContext.Provider>
          {/* Unpin button */}
          <div className="gc-pin-overlay gc-pin-overlay--spotlight">
            <span className="gc-pinned-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" />
              </svg>
              Pinned
            </span>
            <button className="gc-pin-btn gc-pin-btn--active" onClick={unpin} title="Unpin">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {otherTracks.length > 0 && (
        <div className="gc-spotlight-strip">
          {otherTracks.map((track, i) => (
            <div className="gc-spotlight-thumb" key={`${track.participant?.sid}-${track.source}-${i}`}>
              <PinnableParticipantTile track={track} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Video Area ─── */
function VideoArea() {
  const { pinnedTrack } = useContext(PinContext);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  if (pinnedTrack) {
    // Check if pinned track is still valid
    const stillExists = tracks.some(
      (t) =>
        isTrackReference(t) &&
        isTrackReference(pinnedTrack) &&
        t.publication?.trackSid === pinnedTrack.publication?.trackSid,
    );

    if (stillExists) {
      const others = tracks.filter(
        (t) =>
          !(
            isTrackReference(t) &&
            isTrackReference(pinnedTrack) &&
            t.publication?.trackSid === pinnedTrack.publication?.trackSid
          ),
      );
      return <SpotlightView pinnedTrack={pinnedTrack} otherTracks={others} />;
    }
  }

  return <GridView tracks={tracks} />;
}

/* ─── Chat Sidebar ─── */
function ChatPanel({ onClose }: { onClose: () => void }) {
  const { chatMessages, send } = useChat();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    send(inputValue.trim());
    setInputValue('');
  };

  return (
    <div className="gc-side-panel">
      <div className="gc-side-panel-header">
        <span className="gc-side-panel-title">In-call messages</span>
        <button className="gc-icon-btn" onClick={onClose} title="Close chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="gc-chat-messages" ref={scrollRef}>
        {chatMessages.length === 0 && (
          <div className="gc-chat-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Messages are only visible to people in the call and are deleted when the call ends.</p>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} className="gc-chat-msg">
            <div className="gc-chat-msg-meta">
              <span className="gc-chat-msg-name">
                {msg.from?.name || msg.from?.identity || 'Unknown'}
              </span>
              <span className="gc-chat-msg-time">
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <p className="gc-chat-msg-text">{msg.message}</p>
          </div>
        ))}
      </div>
      <div className="gc-chat-input-bar">
        <input
          className="gc-chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="Send a message to everyone"
        />
        <button className="gc-send-btn" onClick={handleSend} disabled={!inputValue.trim()} title="Send">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Participants Panel ─── */
function ParticipantsPanel({ onClose }: { onClose: () => void }) {
  const participants = useParticipants();

  return (
    <div className="gc-side-panel">
      <div className="gc-side-panel-header">
        <span className="gc-side-panel-title">People ({participants.length})</span>
        <button className="gc-icon-btn" onClick={onClose} title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="gc-participants-list">
        {participants.map((p) => {
          const name = p.name || p.identity || 'Unknown';
          const initial = name.charAt(0).toUpperCase();
          const isMuted = !p.isMicrophoneEnabled;
          const isCameraOff = !p.isCameraEnabled;
          const isLocal = p.isLocal;
          const isSpeaking = p.isSpeaking;

          return (
            <div key={p.sid} className={`gc-participant-row ${isSpeaking ? 'gc-participant-row--speaking' : ''}`}>
              <div className="gc-participant-avatar"><span>{initial}</span></div>
              <div className="gc-participant-info">
                <span className="gc-participant-name">
                  {name}
                  {isLocal && <span className="gc-participant-you">(You)</span>}
                </span>
              </div>
              <div className="gc-participant-status">
                {isMuted ? (
                  <span className="gc-participant-icon gc-participant-icon--off" title="Mic off">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.48-.35 2.17" />
                      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </span>
                ) : (
                  <span className="gc-participant-icon gc-participant-icon--on" title="Mic on">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </span>
                )}
                {isCameraOff ? (
                  <span className="gc-participant-icon gc-participant-icon--off" title="Camera off">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
                    </svg>
                  </span>
                ) : (
                  <span className="gc-participant-icon gc-participant-icon--on" title="Camera on">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Control Bar ─── */
function ControlBar({
  chatOpen,
  participantsOpen,
  onToggleChat,
  onToggleParticipants,
}: {
  chatOpen: boolean;
  participantsOpen: boolean;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
}) {
  const participants = useParticipants();

  return (
    <div className="gc-controls">
      <div className="gc-controls-center">
        <TrackToggle source={Track.Source.Microphone} className="gc-ctrl-btn">
          Mic
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera} className="gc-ctrl-btn">
          Camera
        </TrackToggle>
        <TrackToggle source={Track.Source.ScreenShare} className="gc-ctrl-btn">
          Share
        </TrackToggle>
      </div>
      <div className="gc-controls-right">
        <button
          className={`gc-ctrl-btn gc-ctrl-btn-subtle ${participantsOpen ? 'gc-ctrl-btn-active' : ''}`}
          onClick={onToggleParticipants}
          title="People"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{participants.length}</span>
        </button>
        <button
          className={`gc-ctrl-btn gc-ctrl-btn-subtle ${chatOpen ? 'gc-ctrl-btn-active' : ''}`}
          onClick={onToggleChat}
          title="Chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <DisconnectButton className="gc-leave-btn">Leave</DisconnectButton>
      </div>
    </div>
  );
}

/* ─── Call Stage ─── */
function CallStage() {
  const [activePanel, setActivePanel] = useState<'none' | 'chat' | 'participants'>('none');
  const [pinnedTrack, setPinnedTrack] = useState<TrackReferenceOrPlaceholder | null>(null);

  const pin = useCallback((track: TrackReferenceOrPlaceholder) => setPinnedTrack(track), []);
  const unpin = useCallback(() => setPinnedTrack(null), []);

  const toggleChat = () => setActivePanel((p) => (p === 'chat' ? 'none' : 'chat'));
  const toggleParticipants = () => setActivePanel((p) => (p === 'participants' ? 'none' : 'participants'));

  return (
    <PinContext.Provider value={{ pinnedTrack, pin, unpin }}>
      <div className="gc-stage">
        <div className="gc-video-area">
          <VideoArea />
        </div>
        {activePanel === 'chat' && <ChatPanel onClose={() => setActivePanel('none')} />}
        {activePanel === 'participants' && <ParticipantsPanel onClose={() => setActivePanel('none')} />}
        <ControlBar
          chatOpen={activePanel === 'chat'}
          participantsOpen={activePanel === 'participants'}
          onToggleChat={toggleChat}
          onToggleParticipants={toggleParticipants}
        />
      </div>
    </PinContext.Provider>
  );
}

/* ─── Main Component ─── */
export default function GroupCall({ roomName }: GroupCallProps) {
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    async function loadToken() {
      try {
        const { token: tk } = await getLiveKitToken(roomName);
        setToken(tk);
      } catch (err: any) {
        setError(err.message || 'Failed to get call token');
      } finally {
        setIsConnecting(false);
      }
    }
    loadToken();
  }, [roomName]);

  if (isConnecting) {
    return (
      <div className="gc-status">
        <div className="gc-spinner" />
        <p className="gc-status-text">Joining call…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gc-status gc-status-error">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="gc-root">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={LIVEKIT_URL}
        options={{
          dynacast: true,
          adaptiveStream: true,
          videoCaptureDefaults: {
            resolution: {
              width: 640,
              height: 360,
            },
            frameRate: 15,
          }
        }}
        data-lk-theme="default"
        style={{ height: '100%', width: '100%' }}
      >
        <CallStage />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
