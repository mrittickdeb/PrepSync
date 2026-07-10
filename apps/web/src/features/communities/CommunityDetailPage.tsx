import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import { communityService, CommunityInfo, CommunityPost } from '@/services/community.service';
import { useAuthStore } from '@/stores/authStore';

export default function CommunityDetailPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const [community, setCommunity] = useState<CommunityInfo | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Post composer
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  useEffect(() => {
    if (communityId) {
      fetchCommunityAndPosts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const fetchCommunityAndPosts = async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      setLoadingPosts(true);

      const [communityData, postsData] = await Promise.all([
        communityService.getCommunityDetails(communityId),
        communityService.getCommunityPosts(communityId),
      ]);

      setCommunity(communityData);
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching community details:', error);
    } finally {
      setLoading(false);
      setLoadingPosts(false);
    }
  };

  const handleToggleJoin = async () => {
    if (!community) return;
    try {
      const result = await communityService.toggleJoin(community._id);
      setCommunity({ ...community, members: result.members });
    } catch (error) {
      console.error('Error toggling join:', error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community || !postContent.trim() || submittingPost) return;

    try {
      setSubmittingPost(true);
      const newPost = await communityService.createCommunityPost(community._id, postContent.trim());
      setPosts((prev) => [newPost, ...prev]);
      setPostContent('');
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to create post';
      alert(msg);
    } finally {
      setSubmittingPost(false);
    }
  };

  const isMember = () => {
    if (!community || !currentUser) return false;
    return (community.members as any[]).some(
      (m) => (typeof m === 'string' ? m : m._id).toString() === currentUser._id.toString()
    );
  };

  const getMemberCount = () => {
    return Array.isArray(community?.members) ? community!.members.length : 0;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    } else if (diffHrs < 24) {
      return `${diffHrs}h ago`;
    } else {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!community) {
    return (
      <PageWrapper>
        <div className="py-12 text-center flex flex-col gap-4 max-w-md mx-auto">
          <h2 className="text-display text-text-primary font-sans font-semibold">Community Not Found</h2>
          <p className="text-body text-text-secondary font-sans leading-relaxed">
            The community you are looking for does not exist or has been removed.
          </p>
          <Link to="/community/explore" className="text-accent font-sans font-medium hover:underline">
            ← Return to Explore
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const joined = isMember();
  const memberCount = getMemberCount();

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6 max-w-3xl mx-auto">
        {/* Back link */}
        <Link to="/community/explore" className="flex items-center gap-1 text-caption text-text-secondary hover:text-text-primary font-sans transition-colors self-start">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Explore
        </Link>

        {/* Community Header Card */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <h1 className="text-display text-text-primary font-sans font-bold leading-tight">
                {community.name}
              </h1>
              <p className="text-body text-text-secondary font-sans leading-relaxed">
                {community.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-1">
                <span className="text-caption text-text-muted font-mono font-medium">
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
                {community.creator && (
                  <span className="text-[11px] text-text-muted font-sans">
                    Created by <span className="font-semibold text-text-secondary">{(community.creator as any).name}</span>
                  </span>
                )}
                <span className="text-[11px] text-text-muted font-mono">
                  {new Date(community.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
            <button
              onClick={handleToggleJoin}
              className={`px-6 py-2.5 rounded-md text-caption font-sans font-semibold transition-all cursor-pointer border self-start ${
                joined
                  ? 'bg-accent/10 border-accent text-accent hover:bg-accent/20'
                  : 'bg-accent border-accent text-text-inverse hover:bg-accent/90'
              }`}
            >
              {joined ? '✓ Joined' : 'Join Community'}
            </button>
          </div>
        </div>

        {/* Post Composer (only visible if joined) */}
        {joined && (
          <form onSubmit={handleCreatePost} className="bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={`Share something in ${community.name}...`}
                className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent h-20 resize-none font-sans"
                disabled={submittingPost}
                maxLength={500}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-text-muted font-mono">{postContent.length}/500</span>
              <button
                type="submit"
                disabled={!postContent.trim() || submittingPost}
                className="px-5 py-2 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-semibold hover:bg-accent/90 transition-colors cursor-pointer"
              >
                {submittingPost ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        )}

        {/* Not joined banner */}
        {!joined && (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 text-center">
            <p className="text-caption text-text-secondary font-sans">
              Join this community to post and participate in discussions.
            </p>
          </div>
        )}

        {/* Community Feed */}
        <div className="flex flex-col gap-4">
          <h3 className="text-heading text-text-primary font-sans font-bold">
            Community Posts
          </h3>

          {loadingPosts ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="sm" />
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-10 text-center flex flex-col gap-2">
              <p className="text-body text-text-primary font-sans font-semibold">No posts yet</p>
              <p className="text-caption text-text-secondary font-sans">
                Be the first to share something in this community!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post._id}
                className="bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-3 shadow-sm"
              >
                {/* Post Header */}
                <div className="flex items-center gap-3">
                  <Avatar name={post.author.name} imageUrl={post.author.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-text-primary font-sans font-bold">
                        {post.author.name}
                      </span>
                      {post.author.readinessIndex?.overall !== undefined && (
                        <span className="text-[9px] bg-accent-dim text-accent px-1.5 py-0.5 rounded font-mono font-medium">
                          {post.author.readinessIndex.overall}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">{formatDate(post.createdAt)}</span>
                  </div>
                </div>

                {/* Post Body */}
                <p className="text-body text-text-primary font-sans leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>

                {/* Attachments */}
                {post.attachments && post.attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {post.attachments.map((att, i) => (
                      att.type === 'image' ? (
                        <img key={i} src={att.url} alt="" className="max-h-48 rounded-lg border border-border-subtle object-cover" />
                      ) : (
                        <video key={i} src={att.url} controls className="max-h-48 rounded-lg border border-border-subtle" />
                      )
                    ))}
                  </div>
                )}

                {/* Post Footer */}
                <div className="flex items-center gap-4 border-t border-border-subtle/50 pt-3">
                  <span className="text-[11px] text-text-muted font-sans font-medium flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {post.likes.length}
                  </span>
                  <span className="text-[11px] text-text-muted font-sans font-medium flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {post.commentsCount}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
