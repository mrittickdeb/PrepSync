import { useState, useEffect, useRef } from 'react';
import PageWrapper from '@/components/layout/PageWrapper';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import { socialService, PostInfo, CommentInfo, SuggestionInfo, TrendingHashtag, Attachment } from '@/services/social.service';
import { uploadToCloudinary, getAttachmentType, validateFile } from '@/services/upload.service';
import { useAuthStore } from '@/stores/authStore';

type FeedTab = 'foryou' | 'following';

export default function SocialFeedPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<PostInfo[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionInfo[]>([]);
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('foryou');
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);

  // Media attachments for composer
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Poll creator
  const [isPollMode, setIsPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Comments state
  const [postComments, setPostComments] = useState<Record<string, CommentInfo[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hashtagFilter]);

  const fetchData = async () => {
    try {
      setLoadingPosts(true);

      if (hashtagFilter) {
        const hashtagPosts = await socialService.getPostsByHashtag(hashtagFilter);
        setPosts(hashtagPosts);
      } else {
        const [feedData, suggestionsData, trendingData] = await Promise.all([
          socialService.getFeed(activeTab),
          socialService.getFollowSuggestions(),
          socialService.getTrendingHashtags(),
        ]);
        setPosts(feedData);
        setSuggestions(suggestionsData);
        setTrending(trendingData);
      }
    } catch (error) {
      console.error('Error fetching feed data:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  // ─── Post Composer Actions ───
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || submittingPost) return;

    try {
      setSubmittingPost(true);

      let poll;
      if (isPollMode && pollOptions.filter((o) => o.trim()).length >= 2) {
        poll = { options: pollOptions.filter((o) => o.trim()) };
      }

      const newPost = await socialService.createPost(postContent.trim(), pendingAttachments, poll);
      setPosts((prev) => [newPost, ...prev]);
      setPostContent('');
      setPendingAttachments([]);
      setIsPollMode(false);
      setPollOptions(['', '']);
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      const result = await uploadToCloudinary(file, (p) => setUploadProgress(p));
      const fileType = getAttachmentType(file);
      const att: Attachment = {
        type: fileType === 'image' ? 'image' : 'video',
        url: result.url,
      };
      setPendingAttachments((prev) => [...prev, att]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Post Interaction Handlers ───
  const handleLikePost = async (postId: string) => {
    try {
      const result = await socialService.likePost(postId);
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, likes: result.likes } : post
        )
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleBookmark = async (postId: string) => {
    try {
      const result = await socialService.bookmarkPost(postId);
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, bookmarks: result.bookmarks } : post
        )
      );
    } catch (error) {
      console.error('Error bookmarking:', error);
    }
  };

  const handleRepost = async (postId: string) => {
    try {
      const result = await socialService.repostPost(postId);
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, reposts: result.reposts } : post
        )
      );
    } catch (error) {
      console.error('Error reposting:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post? This action cannot be undone.')) return;
    try {
      await socialService.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    try {
      const result = await socialService.votePoll(postId, optionIndex);
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, poll: result.poll } : post
        )
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to vote';
      alert(msg);
    }
  };

  const handleSharePost = async (postId: string) => {
    const url = `${window.location.origin}/community/feed?post=${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } catch {
      // Fallback
      prompt('Copy this link:', url);
    }
  };

  // ─── Comment Handlers ───
  const handleToggleComments = async (postId: string) => {
    const isExpanded = expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: !isExpanded }));

    if (!isExpanded && !postComments[postId]) {
      try {
        setLoadingComments((prev) => ({ ...prev, [postId]: true }));
        const comments = await socialService.getComments(postId);
        setPostComments((prev) => ({ ...prev, [postId]: comments }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }));
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    const inputContent = commentInputs[postId] || '';
    if (!inputContent.trim()) return;

    try {
      const newComment = await socialService.addComment(postId, inputContent.trim());
      setPostComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post
        )
      );
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    try {
      const result = await socialService.followUser(targetUserId);
      setSuggestions((prev) =>
        prev.map((sug) =>
          sug._id === targetUserId
            ? { ...sug, followers: result.isFollowing ? [...sug.followers, currentUser?._id || ''] : sug.followers.filter((id) => id !== currentUser?._id) }
            : sug
        )
      );
      const feedData = await socialService.getFeed(activeTab);
      setPosts(feedData);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  // ─── Helpers ───
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins}m`;
    } else if (diffHrs < 24) {
      return `${diffHrs}h`;
    } else {
      const diffDays = Math.floor(diffHrs / 24);
      return diffDays < 7 ? `${diffDays}d` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const renderContentWithHashtags = (content: string) => {
    const parts = content.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        const tag = part.slice(1).toLowerCase();
        return (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setHashtagFilter(tag); }}
            className="text-accent hover:underline cursor-pointer font-semibold"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getTotalPollVotes = (poll: PostInfo['poll']) => {
    if (!poll) return 0;
    return poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
  };

  const hasUserVoted = (poll: PostInfo['poll']) => {
    if (!poll || !currentUser) return false;
    return poll.options.some((opt) => opt.votes.includes(currentUser._id));
  };

  return (
    <PageWrapper>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 py-6 max-w-5xl mx-auto">
        {/* ═══ Main Feed Column ═══ */}
        <div className="flex flex-col gap-5">
          {/* Feed Header with Tabs */}
          <div className="flex flex-col gap-0">
            <div className="flex items-center justify-between">
              <h1 className="text-display text-text-primary font-sans font-bold">
                {hashtagFilter ? (
                  <span className="flex items-center gap-2">
                    <button onClick={() => setHashtagFilter(null)} className="text-text-muted hover:text-text-primary cursor-pointer">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    #{hashtagFilter}
                  </span>
                ) : 'Feed'}
              </h1>
            </div>
            {!hashtagFilter && (
              <div className="flex border-b border-border-subtle mt-3">
                {(['foryou', 'following'] as FeedTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-caption font-sans font-semibold transition-colors cursor-pointer relative ${
                      activeTab === tab
                        ? 'text-text-primary'
                        : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface/50'
                    }`}
                  >
                    {tab === 'foryou' ? 'For You' : 'Following'}
                    {activeTab === tab && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-accent rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Rich Post Composer ═══ */}
          <form onSubmit={handleCreatePost} className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What's happening in your prep journey?"
                className="flex-1 bg-transparent border-0 resize-none text-body text-text-primary focus:outline-none focus:ring-0 placeholder:text-text-muted h-16 pt-1 font-sans"
                maxLength={1000}
              />
            </div>

            {/* Media Preview */}
            {pendingAttachments.length > 0 && (
              <div className="flex gap-2 flex-wrap pl-12">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="relative group">
                    {att.type === 'image' ? (
                      <img src={att.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border-subtle" />
                    ) : (
                      <video src={att.url} className="w-20 h-20 object-cover rounded-lg border border-border-subtle" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#D32F2F] text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="pl-12">
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-[10px] text-text-muted font-mono mt-1">{uploadProgress}% uploading...</p>
              </div>
            )}

            {/* Poll Creator */}
            {isPollMode && (
              <div className="pl-12 flex flex-col gap-2">
                <div className="border border-accent/30 rounded-lg p-3 bg-accent/5">
                  <p className="text-[11px] text-accent font-sans font-bold mb-2">📊 Create a Poll</p>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[i] = e.target.value;
                          setPollOptions(updated);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                        maxLength={60}
                      />
                      {pollOptions.length > 2 && (
                        <button type="button" onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-text-muted hover:text-[#D32F2F] cursor-pointer text-caption">×</button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button type="button" onClick={() => setPollOptions((prev) => [...prev, ''])}
                      className="text-[11px] text-accent font-sans font-semibold hover:underline cursor-pointer mt-1">+ Add option</button>
                  )}
                </div>
              </div>
            )}

            {/* Composer Toolbar */}
            <div className="flex items-center justify-between border-t border-border-subtle/50 pt-3 pl-12">
              <div className="flex items-center gap-1">
                {/* Image/Video Upload */}
                <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={uploading || isPollMode}
                  className="p-2 rounded-lg hover:bg-accent/10 text-accent transition-colors cursor-pointer disabled:opacity-40" title="Add photo/video">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </button>
                <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />

                {/* Poll toggle */}
                <button type="button" onClick={() => { setIsPollMode(!isPollMode); setPendingAttachments([]); }}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${isPollMode ? 'bg-accent/20 text-accent' : 'hover:bg-accent/10 text-accent'}`} title="Create poll">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="18" rx="1" /><rect x="11" y="8" width="6" height="13" rx="1" /><rect x="19" y="13" width="2" height="8" rx="1" /></svg>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Character count with progress ring */}
                <div className="relative w-7 h-7">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-subtle)" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="15" fill="none"
                      stroke={postContent.length > 900 ? '#D32F2F' : postContent.length > 700 ? '#F59E0B' : 'var(--accent)'}
                      strokeWidth="2.5" strokeDasharray={`${(postContent.length / 1000) * 94.2} 94.2`} strokeLinecap="round" />
                  </svg>
                  {postContent.length > 800 && (
                    <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold ${postContent.length > 900 ? 'text-[#D32F2F]' : 'text-text-muted'}`}>
                      {1000 - postContent.length}
                    </span>
                  )}
                </div>

                <button type="submit" disabled={!postContent.trim() || submittingPost || uploading}
                  className="px-5 py-1.5 bg-accent disabled:bg-accent/40 text-text-inverse rounded-full text-caption font-sans font-bold hover:bg-accent/90 transition-colors cursor-pointer">
                  {submittingPost ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </form>

          {/* ═══ Feed Timeline ═══ */}
          {loadingPosts ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : posts.length === 0 ? (
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-12 text-center flex flex-col gap-2">
              <p className="text-body text-text-primary font-sans font-semibold">
                {hashtagFilter ? `No posts with #${hashtagFilter}` : 'Feed is empty'}
              </p>
              <p className="text-caption text-text-secondary font-sans leading-relaxed">
                {hashtagFilter ? 'Try a different hashtag or check trending topics.' : 'Follow users or write a post to populate your timeline.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {posts.map((post) => {
                const userHasLiked = post.likes.includes(currentUser?._id || '');
                const userHasBookmarked = (post.bookmarks || []).includes(currentUser?._id || '');
                const userHasReposted = (post.reposts || []).includes(currentUser?._id || '');
                const isOwnPost = post.author._id === currentUser?._id;
                const isCommentsOpen = expandedComments[post._id];
                const comments = postComments[post._id] || [];
                const isLoadingComments = loadingComments[post._id];

                return (
                  <div key={post._id} className="bg-bg-surface border border-border-subtle border-b-0 last:border-b first:rounded-t-xl last:rounded-b-xl p-5 flex flex-col gap-3 hover:bg-bg-overlay/30 transition-colors">
                    {/* Repost indicator */}
                    {userHasReposted && (
                      <p className="text-[10px] text-text-muted font-sans font-medium pl-10 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                        You reposted
                      </p>
                    )}

                    {/* Post Author */}
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <Avatar name={post.author.name} imageUrl={post.author.avatarUrl} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-body text-text-primary font-sans font-bold leading-tight">{post.author.name}</h4>
                            {post.author.readinessIndex?.overall !== undefined && (
                              <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-mono font-bold">
                                {post.author.readinessIndex.overall}
                              </span>
                            )}
                            <span className="text-[10px] text-text-muted font-mono">· {formatDate(post.createdAt)}</span>
                          </div>
                          {post.author.followers && (
                            <p className="text-[10px] text-text-muted font-sans">
                              {formatNumber(post.author.followers.length)} followers
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Post Menu */}
                      {isOwnPost && (
                        <button onClick={() => handleDeletePost(post._id)}
                          className="text-text-muted hover:text-[#D32F2F] transition-colors cursor-pointer p-1" title="Delete post">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      )}
                    </div>

                    {/* Post Content with clickable hashtags */}
                    <p className="text-body text-text-primary font-sans leading-relaxed whitespace-pre-wrap pl-11">
                      {renderContentWithHashtags(post.content)}
                    </p>

                    {/* Media Gallery */}
                    {post.attachments && post.attachments.length > 0 && (
                      <div className={`pl-11 grid gap-1 rounded-xl overflow-hidden ${post.attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {post.attachments.map((att, i) => (
                          att.type === 'image' ? (
                            <img key={i} src={att.url} alt="" className="w-full max-h-80 object-cover rounded-lg border border-border-subtle" />
                          ) : (
                            <video key={i} src={att.url} controls className="w-full max-h-80 rounded-lg border border-border-subtle" />
                          )
                        ))}
                      </div>
                    )}

                    {/* Poll Rendering */}
                    {post.postType === 'poll' && post.poll && (
                      <div className="pl-11 flex flex-col gap-2">
                        {(() => {
                          const totalVotes = getTotalPollVotes(post.poll);
                          const voted = hasUserVoted(post.poll);
                          return post.poll!.options.map((opt, i) => {
                            const votePercent = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                            const userVotedThis = opt.votes.includes(currentUser?._id || '');
                            return (
                              <button key={i} onClick={() => !voted && handleVotePoll(post._id, i)} disabled={voted}
                                className={`relative w-full text-left px-4 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                  voted
                                    ? userVotedThis ? 'border-accent bg-accent/5' : 'border-border-subtle'
                                    : 'border-border-subtle hover:border-accent hover:bg-accent/5'
                                }`}
                              >
                                {voted && (
                                  <div className="absolute inset-0 rounded-lg bg-accent/10 transition-all" style={{ width: `${votePercent}%` }} />
                                )}
                                <div className="relative flex items-center justify-between">
                                  <span className="text-caption text-text-primary font-sans font-semibold flex items-center gap-1.5">
                                    {userVotedThis && <span className="text-accent">✓</span>}
                                    {opt.text}
                                  </span>
                                  {voted && <span className="text-[11px] text-text-muted font-mono font-bold">{votePercent}%</span>}
                                </div>
                              </button>
                            );
                          });
                        })()}
                        <p className="text-[10px] text-text-muted font-sans">
                          {formatNumber(getTotalPollVotes(post.poll))} votes
                          {post.poll.expiresAt && ` · ${new Date(post.poll.expiresAt) > new Date() ? 'Active' : 'Ended'}`}
                        </p>
                      </div>
                    )}

                    {/* Interaction Buttons Row */}
                    <div className="flex items-center justify-between pl-11 pt-1 text-text-muted">
                      {/* Comment */}
                      <button onClick={() => handleToggleComments(post._id)}
                        className={`flex items-center gap-1.5 text-[12px] font-sans transition-colors cursor-pointer group ${isCommentsOpen ? 'text-accent font-semibold' : 'hover:text-accent'}`}>
                        <div className="p-1.5 rounded-full group-hover:bg-accent/10 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        </div>
                        {post.commentsCount > 0 && <span>{formatNumber(post.commentsCount)}</span>}
                      </button>

                      {/* Repost */}
                      <button onClick={() => handleRepost(post._id)}
                        className={`flex items-center gap-1.5 text-[12px] font-sans transition-colors cursor-pointer group ${userHasReposted ? 'text-green-500 font-semibold' : 'hover:text-green-500'}`}>
                        <div className="p-1.5 rounded-full group-hover:bg-green-500/10 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                        </div>
                        {(post.reposts || []).length > 0 && <span>{formatNumber(post.reposts.length)}</span>}
                      </button>

                      {/* Like */}
                      <button onClick={() => handleLikePost(post._id)}
                        className={`flex items-center gap-1.5 text-[12px] font-sans transition-colors cursor-pointer group ${userHasLiked ? 'text-[#D32F2F] font-semibold' : 'hover:text-[#D32F2F]'}`}>
                        <div className="p-1.5 rounded-full group-hover:bg-[#D32F2F]/10 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={userHasLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </div>
                        {post.likes.length > 0 && <span>{formatNumber(post.likes.length)}</span>}
                      </button>

                      {/* Impressions */}
                      <span className="flex items-center gap-1.5 text-[12px] text-text-muted font-sans">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        {formatNumber(post.impressions || 0)}
                      </span>

                      {/* Bookmark & Share */}
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => handleBookmark(post._id)}
                          className={`p-1.5 rounded-full transition-colors cursor-pointer ${userHasBookmarked ? 'text-accent' : 'hover:text-accent hover:bg-accent/10'}`} title="Bookmark">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={userHasBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                        <button onClick={() => handleSharePost(post._id)}
                          className="p-1.5 rounded-full hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer" title="Share">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* ═══ Expandable Comments Section ═══ */}
                    {isCommentsOpen && (
                      <div className="pl-11 border-t border-border-subtle/50 mt-1 pt-3 flex flex-col gap-3">
                        {isLoadingComments ? (
                          <div className="flex items-center justify-center py-4"><Spinner size="sm" /></div>
                        ) : comments.length === 0 ? (
                          <p className="text-caption text-text-muted font-sans italic">No replies yet. Be the first!</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {comments.map((comment) => (
                              <div key={comment._id} className="flex gap-2.5">
                                <Avatar name={comment.author.name} imageUrl={comment.author.avatarUrl} size="sm" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-caption text-text-primary font-sans font-bold">{comment.author.name}</span>
                                    {comment.author.readinessIndex?.overall !== undefined && (
                                      <span className="text-[9px] bg-accent/15 text-accent px-1 py-0.5 rounded-full font-mono font-bold">{comment.author.readinessIndex.overall}</span>
                                    )}
                                    <span className="text-[9px] text-text-muted font-mono">· {formatDate(comment.createdAt)}</span>
                                  </div>
                                  <p className="text-caption text-text-secondary font-sans mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
                          <input
                            type="text"
                            value={commentInputs[post._id] || ''}
                            onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                            placeholder="Post your reply..."
                            className="flex-1 bg-bg-elevated border border-border-subtle rounded-full px-4 py-1.5 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                          />
                          <button onClick={() => handleAddComment(post._id)} disabled={!(commentInputs[post._id] || '').trim()}
                            className="px-4 py-1.5 bg-accent disabled:bg-accent/40 text-text-inverse rounded-full text-caption font-sans font-bold hover:bg-accent/90 transition-colors cursor-pointer">
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Right Sidebar ═══ */}
        <div className="hidden lg:flex flex-col gap-5">
          {/* Trending Hashtags */}
          {trending.length > 0 && !hashtagFilter && (
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
              <h3 className="text-heading text-text-primary font-sans font-bold mb-4">Trending</h3>
              <div className="flex flex-col gap-3">
                {trending.map((tag, i) => (
                  <button key={tag._id} onClick={() => setHashtagFilter(tag._id)}
                    className="flex items-start gap-3 hover:bg-bg-overlay/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer text-left w-full">
                    <span className="text-[10px] text-text-muted font-mono mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-caption text-text-primary font-sans font-bold">#{tag._id}</p>
                      <p className="text-[10px] text-text-muted font-sans">{tag.count} {tag.count === 1 ? 'post' : 'posts'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Who to Follow */}
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
            <h3 className="text-heading text-text-primary font-sans font-bold mb-1">Who to Follow</h3>
            <p className="text-[10px] text-text-secondary font-sans mb-4">Top preparers by readiness score</p>

            {suggestions.length === 0 ? (
              <p className="text-caption text-text-muted font-sans italic">No suggestions available.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {suggestions.map((sug) => {
                  const isFollowing = sug.followers.includes(currentUser?._id || '');
                  return (
                    <div key={sug._id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={sug.name} imageUrl={sug.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <h4 className="text-caption text-text-primary font-sans font-bold truncate leading-tight">{sug.name}</h4>
                          <p className="text-[10px] text-text-muted font-sans">
                            {formatNumber(sug.followers.length)} followers
                            {sug.readinessIndex?.overall !== undefined && (
                              <span className="ml-1">· <span className="text-accent font-mono font-bold">{sug.readinessIndex.overall}</span></span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleToggleFollow(sug._id)}
                        className={`px-3 py-1 rounded-full text-[10px] font-sans font-bold border transition-all shrink-0 cursor-pointer ${
                          isFollowing
                            ? 'border-border-subtle hover:border-[#D32F2F] hover:bg-[#D32F2F]/10 text-text-secondary hover:text-[#D32F2F]'
                            : 'border-accent bg-accent text-text-inverse hover:bg-accent/90'
                        }`}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
