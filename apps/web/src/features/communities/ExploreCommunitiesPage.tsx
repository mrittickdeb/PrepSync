import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import { communityService, CommunityInfo } from '@/services/community.service';
import { useAuthStore } from '@/stores/authStore';

export default function ExploreCommunitiesPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [communities, setCommunities] = useState<CommunityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async (searchTerm = '') => {
    try {
      setLoading(true);
      const data = await communityService.listCommunities(searchTerm);
      setCommunities(data);
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchCommunities(search);
    }
  };

  const handleToggleJoin = async (communityId: string) => {
    try {
      const result = await communityService.toggleJoin(communityId);
      setCommunities((prev) =>
        prev.map((c) => {
          if (c._id === communityId) {
            return { ...c, members: result.members };
          }
          return c;
        })
      );
    } catch (error) {
      console.error('Error toggling join:', error);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createDesc.trim() || submitting) return;

    try {
      setSubmitting(true);
      setCreateError('');
      const newCommunity = await communityService.createCommunity(createName.trim(), createDesc.trim());
      setCommunities((prev) => [newCommunity, ...prev]);
      setCreateName('');
      setCreateDesc('');
      setIsCreateOpen(false);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create community';
      setCreateError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isMember = (community: CommunityInfo) => {
    if (!currentUser) return false;
    return (community.members as string[]).some(
      (id) => id.toString() === currentUser._id.toString()
    );
  };

  const getMemberCount = (community: CommunityInfo) => {
    return Array.isArray(community.members) ? community.members.length : 0;
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Explore Communities
            </h1>
            <p className="text-body text-text-secondary font-sans font-medium">
              Discover and join topic-specific study groups created by members.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-text-inverse rounded-md text-caption font-sans font-semibold transition-colors cursor-pointer self-start md:self-auto"
          >
            + Create Community
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search communities (press Enter)..."
            className="w-full bg-bg-surface border border-border-subtle rounded-md pl-10 pr-4 py-2 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Communities Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : communities.length === 0 ? (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-16 text-center flex flex-col gap-2">
            <p className="text-body text-text-primary font-sans font-semibold">No communities found</p>
            <p className="text-caption text-text-secondary font-sans leading-relaxed">
              Try a different search or create the first community!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communities.map((community) => {
              const joined = isMember(community);
              const count = getMemberCount(community);
              return (
                <div
                  key={community._id}
                  className="bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-accent/40 transition-colors"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/community/explore/${community._id}`}
                        className="text-heading text-text-primary font-sans font-semibold hover:text-accent transition-colors"
                      >
                        {community.name}
                      </Link>
                      <span className="text-[11px] bg-accent-dim text-accent px-2 py-0.5 rounded font-mono font-medium whitespace-nowrap">
                        {count} {count === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    <p className="text-caption text-text-secondary font-sans leading-relaxed line-clamp-2">
                      {community.description}
                    </p>
                    {community.creator && (
                      <p className="text-[10px] text-text-muted font-sans">
                        Created by <span className="font-semibold text-text-secondary">{(community.creator as any).name}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleJoin(community._id)}
                    className={`w-full py-2 rounded-md text-caption font-sans font-semibold transition-all cursor-pointer border ${
                      joined
                        ? 'bg-accent/10 border-accent text-accent hover:bg-accent/20'
                        : 'bg-bg-elevated hover:bg-bg-overlay border-border-subtle text-text-primary'
                    }`}
                  >
                    {joined ? '✓ Joined' : 'Join Community'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl max-w-md w-full p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-heading text-text-primary font-sans font-bold">Create Community</h3>
              <button
                onClick={() => { if (!submitting) setIsCreateOpen(false); }}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Community Name *</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. System Design Wizards"
                  className="bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                  disabled={submitting}
                  maxLength={60}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Description *</label>
                <textarea
                  required
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="What is this community about? Topics, goals, or focus areas..."
                  className="bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent h-28 resize-none font-sans"
                  disabled={submitting}
                  maxLength={500}
                />
              </div>

              {/* Error message */}
              {createError && (
                <p className="text-[11px] text-status-error font-sans font-medium">{createError}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-border-subtle/50 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-border-subtle hover:bg-bg-overlay text-text-secondary rounded-md text-caption font-sans font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createName.trim() || !createDesc.trim() || submitting}
                  className="px-5 py-2 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-semibold hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
