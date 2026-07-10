import { useState, useEffect } from 'react';
import PageWrapper from '@/components/layout/PageWrapper';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import { socialService, PostInfo, CommentInfo, SuggestionInfo } from '@/services/social.service';
import { useAuthStore } from '@/stores/authStore';

export default function SocialFeedPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<PostInfo[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionInfo[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postContent, setPostContent] = useState('');
  
  // Comment and detail drawers state
  const [postComments, setPostComments] = useState<Record<string, CommentInfo[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFeedAndSuggestions();
  }, []);

  const fetchFeedAndSuggestions = async () => {
    try {
      setLoadingPosts(true);
      const [feedData, suggestionsData] = await Promise.all([
        socialService.getFeed(),
        socialService.getFollowSuggestions(),
      ]);
      setPosts(feedData);
      setSuggestions(suggestionsData);
    } catch (error) {
      console.error('Error fetching social feed data:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || submittingPost) return;

    try {
      setSubmittingPost(true);
      const newPost = await socialService.createPost(postContent.trim());
      setPosts((prev) => [newPost, ...prev]);
      setPostContent('');
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const result = await socialService.likePost(postId);
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? { ...post, likes: result.likes }
            : post
        )
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleToggleComments = async (postId: string) => {
    const isExpanded = expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: !isExpanded }));

    // Fetch comments if expanding and not loaded yet
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
      
      // Update comment count on post list
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? { ...post, commentsCount: post.commentsCount + 1 }
            : post
        )
      );
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    try {
      const result = await socialService.followUser(targetUserId);
      
      // Update follow status in suggestions
      setSuggestions((prev) =>
        prev.map((sug) =>
          sug._id === targetUserId
            ? { ...sug, followers: result.isFollowing ? [...sug.followers, currentUser?._id || ''] : sug.followers.filter(id => id !== currentUser?._id) }
            : sug
        )
      );
      
      // Refresh feed to get posts from newly followed user
      const feedData = await socialService.getFeed();
      setPosts(feedData);
    } catch (error) {
      console.error('Error toggling follow status:', error);
    }
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
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  return (
    <PageWrapper>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-6">
        {/* Main Feed Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="border-b border-border-subtle pb-4">
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Social Feed
            </h1>
            <p className="text-body text-text-secondary font-sans font-medium">
              Share progress, ask questions, and follow other engineers on their prep journey.
            </p>
          </div>

          {/* Post Composer */}
          <form onSubmit={handleCreatePost} className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="What did you solve today? Share a code snippet, milestone, or question..."
                className="flex-1 bg-transparent border-0 resize-none text-body text-text-primary focus:outline-none focus:ring-0 placeholder:text-text-muted h-20 pt-1 font-sans"
              />
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle/50 pt-3">
              <span className="text-[11px] text-text-muted font-sans font-medium">
                {postContent.length}/500 characters
              </span>
              <button
                type="submit"
                disabled={!postContent.trim() || submittingPost}
                className="px-5 py-1.5 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-medium hover:bg-accent/90 transition-colors cursor-pointer"
              >
                {submittingPost ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>

          {/* Feed Timeline */}
          {loadingPosts ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-12 text-center flex flex-col gap-2">
              <p className="text-body text-text-primary font-sans font-semibold">Feed is empty</p>
              <p className="text-caption text-text-secondary font-sans leading-relaxed">
                Follow users or write a post yourself to populate your feed timeline.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {posts.map((post) => {
                const userHasLiked = post.likes.includes(currentUser?._id || '');
                const isCommentsOpen = expandedComments[post._id];
                const comments = postComments[post._id] || [];
                const isLoadingComments = loadingComments[post._id];

                return (
                  <div key={post._id} className="bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:border-border-subtle/80 transition-colors">
                    {/* Post Author info */}
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <Avatar name={post.author.name} imageUrl={post.author.avatarUrl} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-body text-text-primary font-sans font-semibold">
                              {post.author.name}
                            </h4>
                            {post.author.readinessIndex?.overall !== undefined && (
                              <span className="text-[10px] bg-accent-dim text-accent px-1.5 py-0.5 rounded font-mono font-medium">
                                Readiness: {post.author.readinessIndex.overall}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-text-muted font-sans font-medium">
                            {formatDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Post Content */}
                    <p className="text-body text-text-secondary font-sans leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>

                    {/* Interaction Buttons */}
                    <div className="flex items-center gap-6 border-t border-border-subtle/50 pt-3 text-caption text-text-muted font-sans">
                      <button
                        onClick={() => handleLikePost(post._id)}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          userHasLiked ? 'text-[#D32F2F] font-semibold' : 'hover:text-[#D32F2F]'
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill={userHasLiked ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span>{post.likes.length}</span>
                      </button>

                      <button
                        onClick={() => handleToggleComments(post._id)}
                        className={`flex items-center gap-1.5 hover:text-accent transition-colors cursor-pointer ${
                          isCommentsOpen ? 'text-accent font-semibold' : ''
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span>{post.commentsCount}</span>
                      </button>
                    </div>

                    {/* Expandable Comments Section */}
                    {isCommentsOpen && (
                      <div className="border-t border-border-subtle/50 mt-2 pt-4 flex flex-col gap-3">
                        {/* Comments List */}
                        {isLoadingComments ? (
                          <div className="flex items-center justify-center py-4">
                            <Spinner size="sm" />
                          </div>
                        ) : comments.length === 0 ? (
                          <p className="text-caption text-text-muted font-sans italic">No comments yet. Be the first to reply!</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {comments.map((comment) => (
                              <div key={comment._id} className="bg-bg-elevated/40 rounded-lg p-3 flex gap-3">
                                <Avatar name={comment.author.name} imageUrl={comment.author.avatarUrl} size="sm" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-caption text-text-primary font-sans font-semibold">
                                        {comment.author.name}
                                      </span>
                                      {comment.author.readinessIndex?.overall !== undefined && (
                                        <span className="text-[9px] bg-accent-dim text-accent px-1.5 py-0.2 rounded font-mono font-medium">
                                          {comment.author.readinessIndex.overall}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] text-text-muted font-mono">{formatDate(comment.createdAt)}</span>
                                  </div>
                                  <p className="text-caption text-text-secondary font-sans mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Leave Comment Field */}
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
                          <input
                            type="text"
                            value={commentInputs[post._id] || ''}
                            onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                            placeholder="Write a reply..."
                            className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                          />
                          <button
                            onClick={() => handleAddComment(post._id)}
                            disabled={!(commentInputs[post._id] || '').trim()}
                            className="px-3 py-1.5 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-medium hover:bg-accent/90 transition-colors cursor-pointer"
                          >
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

        {/* Sidebar Suggestions Column */}
        <div className="hidden lg:flex flex-col gap-6">
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
            <h3 className="text-heading text-text-primary font-sans font-bold mb-1">
              Who to Follow
            </h3>
            <p className="text-caption text-text-secondary font-sans mb-4">
              Connect with top preparers based on readiness score.
            </p>

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
                          <h4 className="text-caption text-text-primary font-sans font-semibold truncate leading-tight">
                            {sug.name}
                          </h4>
                          {sug.readinessIndex?.overall !== undefined && (
                            <p className="text-[10px] text-text-muted font-sans font-medium">
                              Readiness: <span className="font-mono text-accent font-semibold">{sug.readinessIndex.overall}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleFollow(sug._id)}
                        className={`px-3 py-1 rounded-full text-[10px] font-sans font-semibold border transition-colors shrink-0 cursor-pointer ${
                          isFollowing
                            ? 'border-border-subtle hover:border-[#D32F2F] hover:bg-[#D32F2F]/10 text-text-secondary hover:text-[#D32F2F]'
                            : 'border-accent/40 bg-accent-dim text-accent hover:bg-accent hover:text-text-inverse hover:border-accent'
                        }`}
                      >
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
