import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import { videoService, VideoInfo, CommentInfo } from '@/services/video.service';
import { useAuthStore } from '@/stores/authStore';

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [recommended, setRecommended] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (videoId) {
      fetchAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const fetchAll = async () => {
    if (!videoId) return;
    try {
      setLoading(true);
      setLoadingComments(true);

      const [videoData, commentsData, recommendedData] = await Promise.all([
        videoService.getVideo(videoId),
        videoService.getVideoComments(videoId),
        videoService.getRecommendedVideos(videoId),
      ]);

      setVideo(videoData);
      setComments(commentsData);
      setRecommended(recommendedData);

      // Set subscriber info
      if (videoData.author.followers) {
        setSubscriberCount(videoData.author.followers.length);
        setIsSubscribed(videoData.author.followers.includes(currentUser?._id || ''));
      }
    } catch (error) {
      console.error('Error fetching video:', error);
    } finally {
      setLoading(false);
      setLoadingComments(false);
    }
  };

  const handleLike = async () => {
    if (!video) return;
    try {
      const result = await videoService.likeVideo(video._id);
      setVideo({ ...video, likes: result.likes, dislikes: result.dislikes });
    } catch (error) {
      console.error('Error liking:', error);
    }
  };

  const handleDislike = async () => {
    if (!video) return;
    try {
      const result = await videoService.dislikeVideo(video._id);
      setVideo({ ...video, likes: result.likes, dislikes: result.dislikes });
    } catch (error) {
      console.error('Error disliking:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!video) return;
    try {
      const result = await videoService.subscribeToChannel(video.author._id);
      setIsSubscribed(result.isSubscribed);
      setSubscriberCount(result.subscriberCount);
    } catch (error) {
      console.error('Error subscribing:', error);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    } catch {
      prompt('Copy this link:', url);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !commentInput.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const newComment = await videoService.addVideoComment(video._id, commentInput.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentInput('');
      setVideo({ ...video, commentsCount: video.commentsCount + 1 });
    } catch (error) {
      console.error('Error commenting:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-bg-base"><Spinner size="lg" /></div>;
  }

  if (!video) {
    return (
      <PageWrapper>
        <div className="py-12 text-center flex flex-col gap-4 max-w-md mx-auto">
          <h2 className="text-display text-text-primary font-sans font-semibold">Video Not Found</h2>
          <Link to="/community/watch" className="text-accent font-sans font-medium hover:underline">← Back to Videos</Link>
        </div>
      </PageWrapper>
    );
  }

  const hasLiked = video.likes.includes(currentUser?._id || '');
  const hasDisliked = (video.dislikes || []).includes(currentUser?._id || '');
  const totalReactions = video.likes.length + (video.dislikes || []).length;
  const likePercent = totalReactions > 0 ? Math.round((video.likes.length / totalReactions) * 100) : 100;
  const isOwnVideo = video.author._id === currentUser?._id;

  return (
    <PageWrapper>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 py-6 max-w-7xl mx-auto">
        {/* ═══ Main Video Column ═══ */}
        <div className="flex flex-col gap-4">
          {/* Video Player */}
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            <video src={video.url} controls autoPlay className="w-full h-full" />
          </div>

          {/* Video Title */}
          <h1 className="text-display text-text-primary font-sans font-bold leading-tight">
            {video.title}
          </h1>

          {/* Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Channel Info */}
            <div className="flex items-center gap-3">
              <Avatar name={video.author.name} imageUrl={video.author.avatarUrl} size="md" />
              <div>
                <h3 className="text-body text-text-primary font-sans font-bold">{video.author.name}</h3>
                <p className="text-[11px] text-text-muted font-sans">{formatNumber(subscriberCount)} subscribers</p>
              </div>
              {!isOwnVideo && (
                <button onClick={handleSubscribe}
                  className={`ml-2 px-5 py-2 rounded-full text-caption font-sans font-bold transition-all cursor-pointer ${
                    isSubscribed
                      ? 'bg-bg-elevated text-text-secondary hover:bg-bg-overlay border border-border-subtle'
                      : 'bg-text-primary text-bg-base hover:bg-text-primary/90'
                  }`}>
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Like/Dislike Group */}
              <div className="flex items-center bg-bg-surface border border-border-subtle rounded-full overflow-hidden">
                <button onClick={handleLike}
                  className={`flex items-center gap-1.5 px-4 py-2 text-caption font-sans font-bold transition-colors cursor-pointer border-r border-border-subtle ${
                    hasLiked ? 'text-accent' : 'text-text-primary hover:bg-bg-overlay'
                  }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={hasLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {formatNumber(video.likes.length)}
                </button>
                <button onClick={handleDislike}
                  className={`flex items-center gap-1.5 px-4 py-2 text-caption font-sans font-bold transition-colors cursor-pointer ${
                    hasDisliked ? 'text-[#D32F2F]' : 'text-text-primary hover:bg-bg-overlay'
                  }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={hasDisliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="rotate-180">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                </button>
              </div>

              {/* Share */}
              <button onClick={handleShare}
                className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface border border-border-subtle rounded-full text-caption text-text-primary font-sans font-bold hover:bg-bg-overlay transition-colors cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                Share
              </button>
            </div>
          </div>

          {/* Like/Dislike Ratio Bar */}
          {totalReactions > 0 && (
            <div className="h-0.5 bg-bg-elevated rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${likePercent}%` }} />
            </div>
          )}

          {/* Description Box */}
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2 text-caption text-text-primary font-sans font-bold">
              <span>{formatNumber(video.views)} views</span>
              <span>·</span>
              <span>{formatDate(video.createdAt)}</span>
              {video.category && video.category !== 'General' && (
                <>
                  <span>·</span>
                  <span className="text-accent">{video.category}</span>
                </>
              )}
            </div>
            <p className={`text-caption text-text-secondary font-sans leading-relaxed whitespace-pre-wrap ${!showFullDesc && 'line-clamp-3'}`}>
              {video.description}
            </p>
            {video.description.length > 200 && (
              <button onClick={() => setShowFullDesc(!showFullDesc)}
                className="text-caption text-text-primary font-sans font-bold mt-2 cursor-pointer hover:underline">
                {showFullDesc ? 'Show less' : '...more'}
              </button>
            )}
            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {video.tags.map((tag) => (
                  <span key={tag} className="text-[10px] text-accent font-sans font-semibold">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-heading text-text-primary font-sans font-bold">
              {formatNumber(video.commentsCount)} Comments
            </h3>

            {/* Comment Input */}
            <form onSubmit={handleAddComment} className="flex items-start gap-3">
              <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-transparent border-b border-border-subtle px-0 py-2 text-caption text-text-primary focus:outline-none focus:border-text-primary font-sans"
                />
                {commentInput.trim() && (
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setCommentInput('')}
                      className="px-4 py-1.5 text-caption text-text-secondary font-sans font-bold rounded-full hover:bg-bg-overlay transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button type="submit" disabled={submittingComment}
                      className="px-4 py-1.5 bg-accent text-text-inverse text-caption font-sans font-bold rounded-full hover:bg-accent/90 transition-colors cursor-pointer disabled:bg-accent/40">
                      {submittingComment ? 'Posting...' : 'Comment'}
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Comments List */}
            {loadingComments ? (
              <div className="flex items-center justify-center py-8"><Spinner size="sm" /></div>
            ) : comments.length === 0 ? (
              <p className="text-caption text-text-muted font-sans italic py-4">No comments yet. Be the first!</p>
            ) : (
              <div className="flex flex-col gap-4">
                {comments.map((comment) => (
                  <div key={comment._id} className="flex gap-3">
                    <Avatar name={comment.author.name} imageUrl={comment.author.avatarUrl} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-caption text-text-primary font-sans font-bold">{comment.author.name}</span>
                        <span className="text-[10px] text-text-muted font-mono">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-caption text-text-secondary font-sans mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Recommended Sidebar ═══ */}
        <div className="hidden xl:flex flex-col gap-3">
          <h4 className="text-caption text-text-primary font-sans font-bold mb-1">Recommended</h4>
          {recommended.length === 0 ? (
            <p className="text-caption text-text-muted font-sans italic">No recommendations yet.</p>
          ) : (
            recommended.map((rec) => (
              <Link key={rec._id} to={`/community/watch/${rec._id}`}
                className="flex gap-3 group cursor-pointer hover:bg-bg-surface/50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                {/* Thumbnail */}
                <div className="w-[168px] aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative">
                  {rec.thumbnailUrl ? (
                    <img src={rec.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/80 text-text-primary text-[9px] font-mono px-1 rounded">{rec.duration}</span>
                </div>
                {/* Info */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <h5 className="text-caption text-text-primary font-sans font-bold line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                    {rec.title}
                  </h5>
                  <p className="text-[10px] text-text-muted font-sans">{rec.author.name}</p>
                  <p className="text-[10px] text-text-muted font-sans">{formatNumber(rec.views)} views · {formatDate(rec.createdAt)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
