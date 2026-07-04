import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { sendMessage, endSession as endSessionAPI } from '@/services/session.service';
import { clsx } from 'clsx';
import type { Domain, Difficulty } from '@prepsync/shared';
import { DOMAIN_LABELS, DIFFICULTY_LABELS } from '@prepsync/shared';

interface TranscriptEntry {
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  type: 'text' | 'code';
}

interface LocationState {
  question: string;
  domain: Domain;
  difficulty: Difficulty;
  durationMinutes: number;
  startedAt: string;
}

export default function AIRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [codeValue, setCodeValue] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'code'>('text');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [aiPulsing, setAiPulsing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const domain = state?.domain || 'dsa';
  const difficulty = state?.difficulty || 'medium';
  const durationMinutes = state?.durationMinutes || 40;

  // Initialize transcript with AI question
  useEffect(() => {
    if (state?.question) {
      setTranscript([
        {
          role: 'ai',
          content: state.question,
          timestamp: new Date().toISOString(),
          type: 'text',
        },
      ]);
    }
  }, [state?.question]);

  // Timer
  useEffect(() => {
    if (!state?.startedAt) return;
    const startTime = new Date(state.startedAt).getTime();
    const endTime = startTime + durationMinutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) return;
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state?.startedAt, durationMinutes]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timePercentage = state?.startedAt
    ? 1 - timeLeft / (durationMinutes * 60 * 1000)
    : 0;

  const timerColor =
    timePercentage >= 0.95 ? 'var(--color-danger)' :
    timePercentage >= 0.8 ? 'var(--color-warning)' :
    'var(--color-accent)';

  const handleSend = useCallback(async () => {
    if (!sessionId) return;
    const content = activeTab === 'code' ? codeValue : inputValue;
    if (!content.trim()) return;

    const userEntry: TranscriptEntry = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      type: activeTab,
    };

    setTranscript((prev) => [...prev, userEntry]);
    setInputValue('');
    setCodeValue('');
    setSending(true);
    setAiPulsing(true);

    try {
      const response = await sendMessage(sessionId, content.trim(), activeTab);
      setTranscript((prev) => [
        ...prev,
        {
          role: 'ai',
          content: response.aiResponse,
          timestamp: new Date().toISOString(),
          type: 'text',
        },
      ]);
    } catch {
      setTranscript((prev) => [
        ...prev,
        {
          role: 'ai',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString(),
          type: 'text',
        },
      ]);
    } finally {
      setSending(false);
      setAiPulsing(false);
    }
  }, [sessionId, activeTab, inputValue, codeValue]);

  const handleEndSession = async () => {
    if (!sessionId) return;
    setEnding(true);
    try {
      const result = await endSessionAPI(sessionId);
      navigate(`/ai-room/${sessionId}/report`, {
        state: {
          evaluationReport: result.evaluationReport,
          domain,
          difficulty,
        },
      });
    } catch {
      setEnding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-body text-text-muted">Session not found.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg-base flex flex-col">
      {/* Top Bar */}
      <div className="h-12 bg-bg-surface border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-body text-text-primary font-sans font-medium">AI Interview</span>
          <span className="px-2 py-0.5 rounded text-caption font-sans bg-accent/10 text-accent">
            {DOMAIN_LABELS[domain]}
          </span>
          <span
            className="px-2 py-0.5 rounded text-caption font-sans"
            style={{
              backgroundColor: `${
                difficulty === 'easy' ? '#10B981' :
                difficulty === 'medium' ? '#F59E0B' :
                difficulty === 'hard' ? '#EF4444' : '#7C3AED'
              }15`,
              color: difficulty === 'easy' ? '#10B981' :
                difficulty === 'medium' ? '#F59E0B' :
                difficulty === 'hard' ? '#EF4444' : '#7C3AED',
            }}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'font-mono text-code font-medium transition-colors',
                timePercentage >= 0.95 && 'animate-pulse',
              )}
              style={{ color: timerColor }}
            >
              {formatTime(timeLeft)}
            </span>
            {/* Mini progress bar */}
            <div className="w-20 h-1 bg-border-subtle rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${timePercentage * 100}%`, backgroundColor: timerColor }}
              />
            </div>
          </div>

          <Button variant="danger" size="sm" onClick={handleEndSession} isLoading={ending}>
            End Session
          </Button>
        </div>
      </div>

      {/* Main Area — Split panels */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel — Conversation */}
        <div className="w-[400px] bg-bg-surface border-r border-border-subtle flex flex-col shrink-0">
          {/* AI Avatar */}
          <div className="p-4 flex items-center gap-3 border-b border-border-subtle">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-accent text-lg">🤖</span>
              </div>
              {aiPulsing && (
                <div className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-50" />
              )}
            </div>
            <div>
              <p className="text-body text-text-primary font-sans font-medium">AI Interviewer</p>
              <p className="text-caption text-text-muted font-sans">
                {aiPulsing ? 'Thinking...' : 'Ready'}
              </p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {transcript.map((entry, idx) => (
              <div
                key={idx}
                className={clsx(
                  'max-w-[90%] rounded-lg p-3',
                  entry.role === 'ai'
                    ? 'bg-bg-overlay self-start'
                    : 'bg-accent/10 self-end',
                )}
              >
                <p className="text-caption text-text-muted font-sans mb-1">
                  {entry.role === 'ai' ? 'Interviewer' : 'You'}
                </p>
                {entry.type === 'code' ? (
                  <pre className="text-code font-mono text-text-primary whitespace-pre-wrap bg-bg-base p-2 rounded mt-1">
                    {entry.content}
                  </pre>
                ) : (
                  <p className="text-body text-text-primary font-sans whitespace-pre-wrap">
                    {entry.content}
                  </p>
                )}
              </div>
            ))}
            {aiPulsing && (
              <div className="bg-bg-overlay self-start rounded-lg p-3 max-w-[90%]">
                <p className="text-caption text-text-muted font-sans mb-1">Interviewer</p>
                <div className="flex gap-1.5 py-1">
                  <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border-subtle p-3">
            {/* Tab Switcher */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setActiveTab('text')}
                className={clsx(
                  'px-3 py-1 rounded text-caption font-sans transition-colors',
                  activeTab === 'text'
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                Text
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={clsx(
                  'px-3 py-1 rounded text-caption font-sans transition-colors',
                  activeTab === 'code'
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                Code
              </button>
            </div>

            {activeTab === 'code' ? (
              <textarea
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste or write your code here..."
                className="w-full h-24 bg-bg-base border border-border-subtle rounded-md p-3 font-mono text-code text-text-primary resize-none focus:outline-none focus:border-accent placeholder:text-text-muted"
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer... (Enter to send, Shift+Enter for newline)"
                className="w-full h-16 bg-bg-base border border-border-subtle rounded-md p-3 text-body font-sans text-text-primary resize-none focus:outline-none focus:border-accent placeholder:text-text-muted"
              />
            )}

            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleSend} isLoading={sending} disabled={!(activeTab === 'code' ? codeValue : inputValue).trim()}>
                Send
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel — Code Editor / Notes */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor Tabs */}
          <div className="h-10 bg-bg-surface border-b border-border-subtle flex items-center px-4 gap-1 shrink-0">
            <button className="px-3 py-1.5 rounded text-caption font-sans bg-accent/10 text-accent">
              Code Editor
            </button>
            <button className="px-3 py-1.5 rounded text-caption font-sans text-text-muted hover:text-text-primary">
              Notes
            </button>
          </div>

          {/* Editor Area */}
          <div className="flex-1 bg-bg-base p-4">
            <textarea
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              placeholder="// Write your solution here...\n// Use the Code tab in the chat input to submit your code to the AI interviewer.\n\nfunction solution() {\n  \n}"
              className="w-full h-full bg-bg-surface border border-border-subtle rounded-lg p-4 font-mono text-code text-text-primary resize-none focus:outline-none focus:border-accent/30 placeholder:text-text-muted/50"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-10 bg-bg-surface border-t border-border-subtle flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-caption font-sans bg-accent/10 text-accent">
            {DOMAIN_LABELS[domain]}
          </span>
          <span className="text-caption text-text-muted font-sans">
            {DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-1.5 bg-border-subtle rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${timePercentage * 100}%`, backgroundColor: timerColor }}
            />
          </div>
          <span className="text-caption text-text-muted font-sans">{formatTime(timeLeft)} remaining</span>
        </div>
      </div>
    </div>
  );
}
