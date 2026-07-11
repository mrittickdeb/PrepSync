import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageWrapper from '@/components/layout/PageWrapper';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import { videoService, VideoInfo } from '@/services/video.service';
import { uploadToCloudinary, validateFile } from '@/services/upload.service';

const TAG_OPTIONS = ['All', 'DSA', 'System Design', 'Backend', 'Frontend', 'Conceptual', 'Behavioural'];

export default function VideoCatalogPage() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  
  // Upload modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submittingVideo, setSubmittingVideo] = useState(false);

  useEffect(() => {
    fetchVideos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag]);

  const fetchVideos = async (searchTerm = search) => {
    try {
      setLoading(true);
      const data = await videoService.listVideos(searchTerm, selectedTag);
      setVideos(data);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchVideos(search);
    }
  };

  const handleTagToggle = (tag: string) => {
    if (uploadTags.includes(tag)) {
      setUploadTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setUploadTags((prev) => [...prev, tag]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadFile || submittingVideo) return;

    try {
      setSubmittingVideo(true);
      setUploadProgress(0);

      // 1. Upload video file directly to Cloudinary
      const uploadResult = await uploadToCloudinary(uploadFile, (progress) => {
        setUploadProgress(progress);
      });

      // Format duration
      let durationStr = '00:00';
      if (uploadResult.duration) {
        const mins = Math.floor(uploadResult.duration / 60);
        const secs = Math.floor(uploadResult.duration % 60);
        durationStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      // 2. Save video info to backend database
      const newVideo = await videoService.createVideo({
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        url: uploadResult.url,
        thumbnailUrl: '', // Could be extracted or set
        duration: durationStr,
        tags: uploadTags,
      });

      setVideos((prev) => [newVideo, ...prev]);
      
      // Reset form
      setUploadTitle('');
      setUploadDesc('');
      setUploadTags([]);
      setUploadFile(null);
      setUploadProgress(null);
      setIsUploadOpen(false);
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video. Please try again.');
    } finally {
      setSubmittingVideo(false);
    }
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Watch Videos
            </h1>
            <p className="text-body text-text-secondary font-sans font-medium">
              Watch tech videos, system design reviews, and mock coding session playbacks.
            </p>
          </div>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-text-inverse rounded-md text-caption font-sans font-semibold transition-colors cursor-pointer self-start md:self-auto"
          >
            Upload Video
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search videos (press Enter)..."
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

          {/* Tags */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 max-w-xl">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-semibold transition-colors cursor-pointer border ${
                  selectedTag === tag
                    ? 'bg-accent text-text-inverse border-accent'
                    : 'bg-bg-surface hover:bg-bg-overlay border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Video Catalog Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-16 text-center flex flex-col gap-2">
            <p className="text-body text-text-primary font-sans font-semibold">No videos found</p>
            <p className="text-caption text-text-secondary font-sans leading-relaxed">
              Try modifying your search query or filter tags, or upload the first video!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link
                key={video._id}
                to={`/community/watch/${video._id}`}
                className="flex flex-col gap-3 group cursor-pointer"
              >
                {/* Video Thumbnail Placeholder */}
                <div className="aspect-video bg-black/60 border border-border-subtle rounded-xl flex items-center justify-center relative overflow-hidden shadow-sm">
                  {/* Styled play overlay */}
                  <div className="w-12 h-12 rounded-full bg-black/75 flex items-center justify-center text-text-primary opacity-90 group-hover:opacity-100 group-hover:scale-110 group-hover:bg-accent group-hover:text-text-inverse transition-all duration-200">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <span className="absolute bottom-2.5 right-2.5 bg-black/85 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-primary font-medium">
                    {video.duration}
                  </span>
                </div>
                {/* Video Metadata */}
                <div className="flex items-start gap-2.5">
                  <Avatar name={video.author.name} imageUrl={video.author.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <h4 className="text-caption text-text-primary font-sans font-semibold line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                      {video.title}
                    </h4>
                    <p className="text-[11px] text-text-secondary font-sans font-medium">{video.author.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono mt-0.5">
                      <span>{video.views} views</span>
                      <span>•</span>
                      <span>{new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upload Video Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl max-w-md w-full p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-heading text-text-primary font-sans font-bold">Upload Video</h3>
              <button
                onClick={() => {
                  if (!submittingVideo) setIsUploadOpen(false);
                }}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Title *</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Consistent Hashing in 10 mins"
                  className="bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent font-sans"
                  disabled={submittingVideo}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Description</label>
                <textarea
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Describe your video, code references, or goals..."
                  className="bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-caption text-text-primary focus:outline-none focus:border-accent h-24 resize-none font-sans"
                  disabled={submittingVideo}
                />
              </div>

              {/* Tag Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Select Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.filter(tag => tag !== 'All').map((tag) => {
                    const isSelected = uploadTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-accent/20 border-accent text-accent'
                            : 'bg-bg-elevated hover:bg-bg-overlay border-border-subtle text-text-secondary'
                        }`}
                        disabled={submittingVideo}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* File Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-text-secondary font-sans font-medium">Video File *</label>
                <input
                  type="file"
                  required
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      const file = files[0];
                      const validationError = validateFile(file);
                      if (validationError) {
                        alert(validationError);
                        e.target.value = '';
                        setUploadFile(null);
                        return;
                      }
                      setUploadFile(file);
                    }
                  }}
                  className="text-caption text-text-secondary font-sans"
                  disabled={submittingVideo}
                />
              </div>

              {/* Progress Indicator */}
              {uploadProgress !== null && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex justify-between text-[10px] text-text-muted font-mono font-medium">
                    <span>Uploading to storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div className="flex justify-end gap-2 border-t border-border-subtle/50 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={submittingVideo}
                  className="px-4 py-2 border border-border-subtle hover:bg-bg-overlay text-text-secondary rounded-md text-caption font-sans font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadTitle.trim() || !uploadFile || submittingVideo}
                  className="px-5 py-2 bg-accent disabled:bg-accent/40 text-text-inverse rounded-md text-caption font-sans font-semibold hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  {submittingVideo ? 'Processing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
