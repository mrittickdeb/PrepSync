import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ScoreRing, Button, Badge, Spinner } from '@/components/ui';
import { PageWrapper } from '@/components/layout';
import type { Domain, Difficulty } from '@prepsync/shared';
import { DIFFICULTY_LABELS } from '@prepsync/shared';
import api from '@/services/api';

interface EvaluationReport {
  overallScore: number;
  dimensions: {
    correctness: number;
    approachQuality: number;
    timeEfficiency: number;
    communicationClarity: number;
    problemDecomposition: number;
    edgeCaseHandling: number;
  };
  mistakesIdentified: string[];
  strongAnswerExample: string;
  improvementSuggestions: string[];
  topicsToReview: string[];
}

const DIMENSION_LABELS: Record<string, string> = {
  correctness: 'Correctness',
  approachQuality: 'Approach Quality',
  timeEfficiency: 'Time/Space Efficiency',
  communicationClarity: 'Communication Clarity',
  problemDecomposition: 'Problem Decomposition',
  edgeCaseHandling: 'Edge Case Handling',
};

const DIMENSION_COLORS: Record<string, string> = {
  correctness: '#7C3AED',
  approachQuality: '#0EA5E9',
  timeEfficiency: '#10B981',
  communicationClarity: '#F59E0B',
  problemDecomposition: '#EC4899',
  edgeCaseHandling: '#06B6D4',
};

export default function EvaluationReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const state = location.state as {
    evaluationReport: EvaluationReport;
    domain: Domain;
    difficulty: Difficulty;
  } | null;

  const [reportState, setReportState] = useState(state);
  const [isLoading, setIsLoading] = useState(!state?.evaluationReport);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportState?.evaluationReport && sessionId) {
      setIsLoading(true);
      api.get(`/sessions/${sessionId}`)
        .then((res) => {
          const session = res.data;
          if (session.evaluationReport) {
            setReportState({
              evaluationReport: session.evaluationReport,
              domain: session.domain,
              difficulty: session.difficulty,
            });
          } else {
            setError(session.status === 'active' ? 'Session is still active' : 'Report not found for this session.');
          }
        })
        .catch(() => {
          setError('Failed to load report.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [sessionId, reportState]);

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" className="mb-4" />
          <p className="text-body text-text-muted">Loading your report...</p>
        </div>
      </PageWrapper>
    );
  }

  if (error || !reportState?.evaluationReport) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-body text-text-muted mb-4">{error || 'Report not found.'}</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const { evaluationReport: report, domain, difficulty } = reportState;

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-display text-text-primary font-sans">Evaluation Report</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="domain" domain={domain} />
              <span className="text-caption text-text-muted font-sans">
                {DIFFICULTY_LABELS[difficulty]}
              </span>
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </Button>
        </div>

        {/* Score Ring + Overall */}
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-8 mb-6 flex items-center gap-8">
          <ScoreRing score={report.overallScore} size={140} />
          <div>
            <p className="text-[40px] leading-none font-mono font-semibold text-text-primary">
              {report.overallScore}<span className="text-heading text-text-muted">/100</span>
            </p>
            <p className="text-body text-text-secondary font-sans mt-2">
              {report.overallScore >= 80
                ? 'Excellent performance! Keep it up.'
                : report.overallScore >= 60
                  ? 'Good job — some areas to improve.'
                  : report.overallScore >= 40
                    ? 'Needs work — review the feedback below.'
                    : 'Significant gaps — focus on the fundamentals.'}
            </p>
          </div>
        </div>

        {/* Dimension Scores */}
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-6 mb-6">
          <h3 className="text-heading text-text-primary font-sans font-semibold mb-5">
            Score Breakdown
          </h3>
          <div className="flex flex-col gap-4">
            {Object.entries(report.dimensions).map(([key, value], index) => (
              <div key={key} className="flex items-center gap-4">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: DIMENSION_COLORS[key] }}
                />
                <div className="w-[180px] shrink-0">
                  <span className="text-body text-text-secondary font-sans">
                    {DIMENSION_LABELS[key]}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--color-border-subtle)]">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${value}%`,
                        backgroundColor: DIMENSION_COLORS[key],
                        transitionDelay: `${index * 100}ms`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-code font-mono text-text-primary w-8 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Two Columns: Mistakes + Suggestions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Mistakes */}
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
            <h3 className="text-heading text-text-primary font-sans font-semibold mb-3 flex items-center gap-2">
              <span className="text-danger">⚠</span> Mistakes Identified
            </h3>
            {report.mistakesIdentified.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {report.mistakesIdentified.map((m, i) => (
                  <li key={i} className="text-body text-text-secondary font-sans flex gap-2">
                    <span className="text-danger shrink-0">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-text-muted">No major mistakes identified.</p>
            )}
          </div>

          {/* Improvement Suggestions */}
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
            <h3 className="text-heading text-text-primary font-sans font-semibold mb-3 flex items-center gap-2">
              <span className="text-accent">💡</span> How to Improve
            </h3>
            <ul className="flex flex-col gap-2">
              {report.improvementSuggestions.map((s, i) => (
                <li key={i} className="text-body text-text-secondary font-sans flex gap-2">
                  <span className="text-accent shrink-0">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Strong Answer Example */}
        {report.strongAnswerExample && (
          <div className="bg-bg-surface border border-accent/20 rounded-lg p-6 mb-6">
            <h3 className="text-heading text-text-primary font-sans font-semibold mb-3 flex items-center gap-2">
              <span className="text-success">✦</span> What a Strong Answer Looks Like
            </h3>
            <p className="text-body text-text-secondary font-sans whitespace-pre-wrap">
              {report.strongAnswerExample}
            </p>
          </div>
        )}

        {/* Topics to Review */}
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-6 mb-8">
          <h3 className="text-heading text-text-primary font-sans font-semibold mb-3">
            📚 Practice These Next
          </h3>
          <div className="flex flex-wrap gap-2">
            {report.topicsToReview.map((topic, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-caption font-sans"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/history')}>
            View All Sessions
          </Button>
          <Button onClick={() => navigate('/ai-room')}>
            Start Another Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
