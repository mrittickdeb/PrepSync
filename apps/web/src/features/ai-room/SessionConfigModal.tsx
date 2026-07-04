import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from '@/components/ui';
import { createSession } from '@/services/session.service';
import { clsx } from 'clsx';
import type { Domain, Difficulty } from '@prepsync/shared';
import { DOMAIN_LABELS, DIFFICULTY_LABELS } from '@prepsync/shared';

interface SessionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOMAINS: Domain[] = ['dsa', 'systemDesign', 'backend', 'conceptual', 'behavioural'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'faang'];
const DURATIONS = [20, 40, 60];

const DOMAIN_ICONS: Record<Domain, string> = {
  dsa: '🧮',
  systemDesign: '🏗️',
  backend: '⚙️',
  conceptual: '📖',
  behavioural: '🗣️',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#10B981',
  medium: '#F59E0B',
  hard: '#EF4444',
  faang: '#7C3AED',
};

export default function SessionConfigModal({ isOpen, onClose }: SessionConfigModalProps) {
  const [domain, setDomain] = useState<Domain>('dsa');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [duration, setDuration] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await createSession(domain, difficulty, duration);
      onClose();
      navigate(`/ai-room/${response.sessionId}`, {
        state: {
          question: response.question,
          domain: response.domain,
          difficulty: response.difficulty,
          durationMinutes: response.durationMinutes,
          startedAt: response.startedAt,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start session';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start AI Interview">
      <div className="flex flex-col gap-6">
        {/* Domain Selection */}
        <div>
          <label className="text-body text-text-primary font-sans font-medium mb-3 block">
            Domain
          </label>
          <div className="grid grid-cols-5 gap-2">
            {DOMAINS.map((d) => (
              <button
                key={d}
                onClick={() => setDomain(d)}
                className={clsx(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                  domain === d
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border-subtle text-text-secondary hover:border-text-muted',
                )}
              >
                <span className="text-xl">{DOMAIN_ICONS[d]}</span>
                <span className="text-caption font-sans">{DOMAIN_LABELS[d]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div>
          <label className="text-body text-text-primary font-sans font-medium mb-3 block">
            Difficulty
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={clsx(
                  'px-4 py-2.5 rounded-lg border text-body font-sans font-medium transition-all',
                  difficulty === d
                    ? 'border-2'
                    : 'border-border-subtle text-text-secondary hover:border-text-muted',
                )}
                style={
                  difficulty === d
                    ? { borderColor: DIFFICULTY_COLORS[d], color: DIFFICULTY_COLORS[d], backgroundColor: `${DIFFICULTY_COLORS[d]}10` }
                    : undefined
                }
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Selection */}
        <div>
          <label className="text-body text-text-primary font-sans font-medium mb-3 block">
            Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={clsx(
                  'px-4 py-2.5 rounded-lg border text-body font-sans font-medium transition-all',
                  duration === d
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border-subtle text-text-secondary hover:border-text-muted',
                )}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-caption text-danger font-sans">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleStart} isLoading={loading} className="flex-1">
            Start Interview
          </Button>
        </div>
      </div>
    </Modal>
  );
}
