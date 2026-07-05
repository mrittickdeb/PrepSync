import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '@/components/layout';
import { Button } from '@/components/ui';
import { clsx } from 'clsx';
import { listSessions, endSession } from '@/services/session.service';

const DOMAIN_LABELS: Record<string, string> = {
  dsa: 'DSA',
  systemDesign: 'System Design',
  backend: 'Backend',
  conceptual: 'Conceptual',
  behavioural: 'Behavioural',
};

const DOMAIN_COLORS: Record<string, string> = {
  dsa: '#7C3AED',
  systemDesign: '#0EA5E9',
  backend: '#10B981',
  conceptual: '#F59E0B',
  behavioural: '#EC4899',
};

interface SessionData {
  _id: string;
  type: 'ai' | 'peer';
  domain: string;
  difficulty: string;
  durationMinutes: number;
  status: string;
  startedAt: string;
  evaluationReport?: { overallScore: number };
}

export default function SessionHistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ai' | 'peer'>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchSessions();
  }, [page, filter, domainFilter]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (filter !== 'all') params.type = filter;
      if (domainFilter !== 'all') params.domain = domainFilter;
      const data = await listSessions(params);
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="text-display text-text-primary font-sans mb-1">Session History</h1>
        <p className="text-body text-text-secondary font-sans">Review your past interview practice sessions.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex bg-bg-surface border border-border-subtle rounded-lg p-0.5">
          {(['all', 'ai', 'peer'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={clsx(
                'px-4 py-1.5 rounded-md text-caption font-sans transition-colors capitalize',
                filter === f
                  ? 'bg-accent text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {f === 'all' ? 'All' : f === 'ai' ? 'AI' : 'Peer'}
            </button>
          ))}
        </div>
        <select
          value={domainFilter}
          onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
          className="bg-bg-surface border border-border-subtle rounded-md px-3 py-1.5 text-caption font-sans text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="all">All Domains</option>
          {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Sessions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-body text-text-muted font-sans mb-2">No sessions found</p>
          <p className="text-caption text-text-muted font-sans">Start a new practice session to build your history.</p>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Date</th>
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Domain</th>
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Type</th>
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Difficulty</th>
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Duration</th>
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Score</th>
                <th className="text-left text-caption text-text-muted font-sans font-medium px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s._id}
                  className="border-b border-border-subtle/50 hover:bg-bg-overlay/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (s.type === 'ai' && s.evaluationReport) {
                      navigate(`/ai-room/${s._id}/report`);
                    }
                  }}
                >
                  <td className="px-4 py-3 text-body text-text-primary font-sans">
                    {new Date(s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-caption font-sans"
                      style={{ backgroundColor: `${DOMAIN_COLORS[s.domain] || '#666'}15`, color: DOMAIN_COLORS[s.domain] || '#666' }}
                    >
                      {DOMAIN_LABELS[s.domain] || s.domain}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body text-text-secondary font-sans capitalize">{s.type}</td>
                  <td className="px-4 py-3 text-body text-text-secondary font-sans capitalize">{s.difficulty}</td>
                  <td className="px-4 py-3 text-body text-text-secondary font-mono">{s.durationMinutes}m</td>
                  <td className="px-4 py-3">
                    {s.evaluationReport ? (
                      <span className="text-body text-text-primary font-mono font-medium">
                        {s.evaluationReport.overallScore}%
                      </span>
                    ) : (
                      <span className="text-caption text-text-muted font-sans">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded text-caption font-sans capitalize',
                      s.status === 'completed' ? 'bg-success/10 text-success' :
                      s.status === 'active' ? 'bg-accent/10 text-accent' :
                      'bg-text-muted/10 text-text-muted',
                    )}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.type === 'ai' && s.status === 'active' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/ai-room/${s._id}`);
                        }}>Resume</Button>
                        <Button size="sm" variant="danger" onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await endSession(s._id);
                            fetchSessions();
                          } catch {
                            // ignore
                          }
                        }}>End</Button>
                      </div>
                    )}
                    {s.type === 'ai' && s.evaluationReport && (
                      <Button size="sm" variant="ghost">View Report</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {sessions.length > 0 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-body text-text-muted font-sans px-3 py-1.5">Page {page}</span>
          <Button size="sm" variant="ghost" disabled={sessions.length < 20} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </PageWrapper>
  );
}
