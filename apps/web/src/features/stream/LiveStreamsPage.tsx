import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import { streamService, StreamInfo } from '@/services/stream.service';

const CATEGORY_OPTIONS = ['All', 'DSA', 'System Design', 'Backend', 'Frontend', 'Behavioural', 'General'];

export default function LiveStreamsPage() {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Go Live modal states
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDesc, setLiveDesc] = useState('');
  const [liveCategory, setLiveCategory] = useState('General');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStreams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const fetchStreams = async (searchTerm = search) => {
    try {
      setLoading(true);
      const data = await streamService.listActiveStreams(searchTerm, selectedCategory);
      setStreams(data);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchStreams(search);
    }
  };

  const handleGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTitle.trim() || submitting) return;

    try {
      setSubmitting(true);
      const newStream = await streamService.goLive(liveTitle.trim(), liveDesc.trim(), liveCategory);
      setStreams((prev) => [newStream, ...prev]);
      setLiveTitle('');
      setLiveDesc('');
      setLiveCategory('General');
      setIsGoLiveOpen(false);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to go live';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Live Streams
            </h1>
            <p className="text-body text-text-secondary font-sans font-medium">
              Join active study broadcasts, pair programming sessions, or live discussions.
            </p>
          </div>
          <button
            onClick={() => setIsGoLiveOpen(true)}
            className="px-5 py-2.5 bg-[#D32F2F] hover:bg-[#D32F2F]/90 text-text-inverse rounded-md text-caption font-sans font-semibold transition-colors cursor-pointer self-start md:self-auto flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Go Live
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search streams (press Enter)..."
              className="w-full bg-bg-surface border border-border-subtle rounded-md pl-10 pr-4 py-2 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Category Tags */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 max-w-xl">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-semibold transition-colors cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-accent text-text-inverse border-accent'
                    : 'bg-bg-surface hover:bg-bg-overlay border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Streams Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : streams.length === 0 ? (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-16 text-center flex flex-col gap-2">
            <p className="text-body text-text-primary font-sans font-semibold">No active streams</p>
            <p className="text-caption text-text-secondary font-sans leading-relaxed">
              Be the first to go live and start a study broadcast!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {streams.map((stream) => (
              <Link
                key={stream._id}
                to={`/community/live/${stream._id}`}
                className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden group cursor-pointer hover:border-accent/40 transition-colors flex flex-col justify-between"
              >
                {/* Stream Video Placeholder */}
                <div className="aspect-video bg-black flex items-center justify-center relative">
                  <span className="absolute top-2.5 left-2.5 bg-[#D32F2F] text-text-inverse px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    Live
                  </span>
                  <span className="absolute top-2.5 right-2.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-text-primary font-medium">
                    {stream.viewers} watching
                  </span>
                  {stream.category && stream.category !== 'General' && (
                    <span className="absolute bottom-2.5 left-2.5 bg-accent/90 text-text-inverse px-2 py-0.5 rounded text-[9px] font-sans font-semibold">
                      {stream.category}
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
                      <polygon points="12 7 17 12 12 17 12 7" />
                    </svg>
                  </div>
                </div>
                {/* Stream Details */}
                <div className="p-4 flex flex-col gap-2">
                  <h4 className="text-body text-text-primary font-sans font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                    {stream.title}
                  </h4>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={stream.host.name} imageUrl={stream.host.avatarUrl} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-caption text-text-primary font-sans font-medium">{stream.host.name}</span>
                      <span className="text-[10px] text-accent font-sans font-semibold">Join Stream →</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Go Live Modal */}
      {isGoLiveOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl max-w-md w-full p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-heading text-text-primary font-sans font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] animate-pulse" />
                Go Live
              </h3>
              <button
                onClick={() => { if (!submitting) setIsGoLiveOpen(false); }}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleGoLive} className="flex flex-col gap-4">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Stream Title *</label>
                <input
                  type="text"
                  required
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="e.g. Solving LeetCode Hard Patterns Live!"
                  className="bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                  disabled={submitting}
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Description</label>
                <textarea
                  value={liveDesc}
                  onChange={(e) => setLiveDesc(e.target.value)}
                  placeholder="What will you be streaming today?"
                  className="bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent h-20 resize-none font-sans"
                  disabled={submitting}
                  maxLength={500}
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.filter(c => c !== 'All').map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLiveCategory(cat)}
                      className={`px-2.5 py-1 rounded text-[10px] font-sans font-semibold border transition-colors cursor-pointer ${
                        liveCategory === cat
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-bg-elevated hover:bg-bg-overlay border-border-subtle text-text-secondary'
                      }`}
                      disabled={submitting}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-border-subtle/50 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsGoLiveOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-border-subtle hover:bg-bg-overlay text-text-secondary rounded-md text-caption font-sans font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!liveTitle.trim() || submitting}
                  className="px-5 py-2 bg-[#D32F2F] disabled:bg-[#D32F2F]/40 text-text-inverse rounded-md text-caption font-sans font-semibold hover:bg-[#D32F2F]/90 transition-colors cursor-pointer flex items-center gap-2"
                >
                  {submitting ? 'Starting...' : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Start Broadcasting
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
