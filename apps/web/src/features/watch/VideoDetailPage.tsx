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
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    if (videoId) {
      fetchVideoAndComments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const fetchVideoAndComments = async () => {
    if (!videoId) return;
    try {
      setLoading(true);
      setLoadingComments(true);
      
      const [videoData, commentsData] = await Promise.all([
        videoService.getVideo(videoId),
        videoService.getVideoComments(videoId),
      ]);
      
      setVideo(videoData);
      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching video details:', error);
    } finally {
      setLoading(false);
      setLoadingComments(false);
    }
  };

  const handleLikeVideo = async () => {
    if (!video) return;
    try {
      const result = await videoService.likeVideo(video._id);
      setVideo({ ...video, likes: result.likes });
    } catch (error) {
      console.error('Error liking video:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !commentInput.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const newComment = await videoService.addVideoComment(video._id, commentInput.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentInput('');
      setVideo({ ...video, commentsCount: video.commentsCount + 1 });
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
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

  if (!video) {
    return (
      <PageWrapper>
        <div className="py-12 text-center flex flex-col gap-4 max-w-md mx-auto">
          <h2 className="text-display text-text-primary font-sans font-semibold">Video Not Found</h2>
          <p className="text-body text-text-secondary font-sans leading-relaxed">
            The video you are looking for does not exist or has been removed.
          </p>
          <Link to="/community/watch" className="text-accent font-sans font-medium hover:underline">
            ← Return to watch catalog
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const userHasLiked = video.likes.includes(currentUser?._id || '');

  return (
    <PageWrapper>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-6">
        {/* Main Video & Comments Section */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Back button */}
          <Link to="/community/watch" className="flex items-center gap-1 text-caption text-text-secondary hover:text-text-primary font-sans transition-colors self-start">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Watch Catalog
          </Link>

          {/* HTML5 Video Player */}
          <div className="aspect-video w-full bg-black rounded-xl border border-border-subtle overflow-hidden relative shadow-md">
            <video
              src={video.url}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          </div>

          {/* Video Meta Information */}
          <div className="flex flex-col gap-3">
            <h1 className="text-display text-text-primary font-sans font-semibold leading-tight">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
              <div className="flex items-center gap-3 text-caption text-text-muted font-mono font-medium">
                <span>{video.views} views</span>
                <span>•</span>
                <span>{new Date(video.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              
              {/* Like action */}
              <button
                onClick={handleLikeVideo}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all cursor-pointer text-caption font-sans font-semibold ${
                  userHasLiked
                    ? 'border-[#D32F2F] bg-[#D32F2F]/10 text-[#D32F2F]'
                    : 'border-border-subtle hover:bg-bg-overlay text-text-secondary hover:text-text-primary'
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
                <span>{video.likes.length} Likes</span>
              </button>
            </div>
          </div>

          {/* Author Block */}
          <div className="flex items-center justify-between bg-bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar name={video.author.name} imageUrl={video.author.avatarUrl} size="md" />
              <div>
                <h4 className="text-body text-text-primary font-sans font-bold">{video.author.name}</h4>
                {video.author.readinessIndex?.overall !== undefined && (
                  <p className="text-[11px] text-text-secondary font-sans font-medium">
                    Readiness Score: <span className="font-mono text-accent font-semibold">{video.author.readinessIndex.overall}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Description Block */}
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-2">
            <h4 className="text-caption text-text-primary font-sans font-bold uppercase tracking-wider">
              Description
            </h4>
            <p className={`text-caption text-text-secondary font-sans leading-relaxed whitespace-pre-wrap ${!showFullDesc && 'line-clamp-3'}`}>
              {video.description || 'No description provided.'}
            </p>
            {video.description && video.description.length > 200 && (
              <button
                onClick={() => setShowFullDesc(!showFullDesc)}
                className="text-[11px] text-accent font-sans font-semibold hover:underline self-start cursor-pointer mt-1"
              >
                {showFullDesc ? 'Show Less' : 'Show More'}
              </button>
            )}
            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {video.tags.map((tag) => (
                  <span key={tag} className="bg-bg-elevated border border-border-subtle px-2 py-0.5 rounded text-[10px] text-text-muted font-sans font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="flex flex-col gap-4 mt-2">
            <h3 className="text-heading text-text-primary font-sans font-bold">
              {video.commentsCount} Comments
            </h3>

            {/* Comment Composer */}
            <form onSubmit={handleAddComment} className="flex gap-3">
              <Avatar name={currentUser?.name || 'User'} imageUrl={currentUser?.avatarUrl} size="sm" />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  required
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Add a public comment..."
                  className="flex-1 bg-bg-surface border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                  disabled={submittingComment}
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || submittingComment}
                  className="px-5 py-2 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-semibold hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  Comment
                </button>
              </div>
            </form>

            {/* Comments list */}
            {loadingComments ? (
              <div className="flex items-center justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-caption text-text-muted font-sans italic py-4">No comments yet. Leave a note!</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((comment) => (
                  <div key={comment._id} className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex gap-3 shadow-sm">
                    <Avatar name={comment.author.name} imageUrl={comment.author.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-caption text-text-primary font-sans font-bold leading-none">
                            {comment.author.name}
                          </span>
                          {comment.author.readinessIndex?.overall !== undefined && (
                            <span className="text-[9px] bg-accent-dim text-accent px-1.5 py-0.2 rounded font-mono font-medium leading-none">
                              {comment.author.readinessIndex.overall}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-text-muted font-mono">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-caption text-text-secondary font-sans mt-2 whitespace-pre-wrap leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar suggestions (Placeholder details) */}
        <div className="hidden lg:flex flex-col gap-5">
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col gap-3">
            <h3 className="text-heading text-text-primary font-sans font-bold">Related Info</h3>
            <p className="text-caption text-text-secondary font-sans leading-relaxed">
              Upload study session logs or video walkthroughs to increase your readiness index score!
            </p>
            <div className="border-t border-border-subtle/50 pt-3">
              <p className="text-caption text-text-muted font-sans italic">
                Tip: Videos tagged with <strong>DSA</strong> or <strong>System Design</strong> receive 2x engagement from community moderators.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
