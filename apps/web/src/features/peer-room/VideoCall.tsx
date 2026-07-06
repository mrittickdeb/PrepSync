import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  sendWebRTCOffer,
  sendWebRTCAnswer,
  sendICECandidate,
  getSocket,
} from '@/services/socket';

interface VideoCallProps {
  roomId: string;
  displayName: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN server when available:
    // { urls: 'turn:your-turn.example.com:3478', username: 'user', credential: 'pass' },
  ],
};

export default function VideoCall({ roomId, displayName }: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaPromiseRef = useRef<Promise<void> | null>(null);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // Start media and signaling on mount
  useEffect(() => {
    mediaPromiseRef.current = startMedia();
    setupSignaling();

    return () => {
      cleanup();
    };
  }, [roomId]);

  const startMedia = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera/microphone access denied. Please allow permissions.');
      console.error('[WebRTC] Media error:', err);
    }
  };

  const setupSignaling = () => {
    const socket = getSocket();

    socket.on('webrtc:offer', async (data: { offer: RTCSessionDescriptionInit; socketId: string }) => {
      setConnecting(true);
      try {
        if (mediaPromiseRef.current) await mediaPromiseRef.current;
        await createPeerConnection();
        const pc = pcRef.current!;
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWebRTCAnswer(roomId, answer);
      } catch (err) {
        console.error('[WebRTC] Answer error:', err);
      }
    });

    socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      try {
        const pc = pcRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      } catch (err) {
        console.error('[WebRTC] Set answer error:', err);
      }
    });

    socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        const pc = pcRef.current;
        if (pc && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('[WebRTC] ICE error:', err);
      }
    });

    // When a new user joins the room, initiate the call
    socket.on('room:user-joined', async () => {
      if (mediaPromiseRef.current) await mediaPromiseRef.current;
      initiateCall();
    });
  };

  const createPeerConnection = async () => {
    if (pcRef.current) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnected(true);
        setConnecting(false);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendICECandidate(roomId, event.candidate.toJSON());
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setConnected(false);
        setConnecting(false);
      }
    };
  };

  const initiateCall = async () => {
    setConnecting(true);
    try {
      await createPeerConnection();
      const pc = pcRef.current!;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWebRTCOffer(roomId, offer);
    } catch (err) {
      console.error('[WebRTC] Offer error:', err);
      setConnecting(false);
    }
  };

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;

    const socket = getSocket();
    socket.off('webrtc:offer');
    socket.off('webrtc:answer');
    socket.off('webrtc:ice-candidate');
  };

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Remote video (partner) */}
      <div className="relative aspect-video bg-bg-base rounded-lg overflow-hidden">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
              <span className="text-xl text-accent">👤</span>
            </div>
            <p className="text-caption text-text-muted font-sans">
              {connecting ? 'Connecting...' : 'Waiting for partner'}
            </p>
            {connecting && (
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mt-2" />
            )}
          </div>
        )}
      </div>

      {/* Local video (you) */}
      <div className="relative aspect-video bg-bg-base rounded-lg overflow-hidden">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={clsx('w-full h-full object-cover', !videoEnabled && 'invisible')}
        />
        {!videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-accent font-medium">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2">
          <span className="text-caption text-text-primary font-sans bg-bg-base/80 px-2 py-0.5 rounded">
            You
          </span>
        </div>

        {error && (
          <div className="absolute top-2 left-2 right-2">
            <p className="text-[10px] text-danger bg-bg-base/90 px-2 py-1 rounded">{error}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={toggleAudio}
          className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
            audioEnabled
              ? 'bg-bg-overlay hover:bg-bg-elevated text-text-primary'
              : 'bg-danger text-white',
          )}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </button>
        <button
          onClick={toggleVideo}
          className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
            videoEnabled
              ? 'bg-bg-overlay hover:bg-bg-elevated text-text-primary'
              : 'bg-danger text-white',
          )}
          title={videoEnabled ? 'Camera Off' : 'Camera On'}
        >
          {videoEnabled ? '📹' : '📷'}
        </button>
        {!connected && !connecting && (
          <button
            onClick={initiateCall}
            className="w-9 h-9 rounded-full bg-success flex items-center justify-center text-white hover:opacity-90 transition-opacity"
            title="Start Call"
          >
            📞
          </button>
        )}
      </div>
    </div>
  );
}
