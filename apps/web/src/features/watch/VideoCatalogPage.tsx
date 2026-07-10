import PageWrapper from '@/components/layout/PageWrapper';

export default function VideoCatalogPage() {
  const dummyVideos = [
    { title: 'Consistent Hashing Explained In 10 Minutes', duration: '9:42', views: '1.2k views', author: 'Alex Xu', date: '3 days ago' },
    { title: 'Mock Technical Interview: Google Senior SWE', duration: '45:12', views: '4.8k views', author: 'PrepSync AI', date: '1 week ago' },
    { title: 'How to Solve Hard Backtracking Problems with DFS', duration: '18:25', views: '930 views', author: 'CodeWizard', date: '2 days ago' },
    { title: 'Designing a Rate Limiter: System Design Primer', duration: '22:40', views: '2.1k views', author: 'TechArchitect', date: '5 days ago' },
  ];

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Watch Videos
            </h1>
            <p className="text-body text-text-secondary font-sans">
              Watch tech videos, system design reviews, and mock coding session playbacks.
            </p>
          </div>
          <button className="px-4 py-2 bg-accent text-text-inverse rounded-md text-caption font-sans font-medium hover:bg-accent/90 transition-colors">
            Upload Video
          </button>
        </div>

        {/* Video Catalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {dummyVideos.map((video) => (
            <div key={video.title} className="flex flex-col gap-2 group cursor-pointer">
              {/* Video Thumbnail Placeholder */}
              <div className="aspect-video bg-bg-surface border border-border-subtle rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center text-text-primary group-hover:scale-110 transition-transform">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <span className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-primary font-medium">
                  {video.duration}
                </span>
              </div>
              {/* Video Metadata */}
              <div className="flex flex-col gap-0.5">
                <h4 className="text-caption text-text-primary font-sans font-medium line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                  {video.title}
                </h4>
                <p className="text-[11px] text-text-secondary font-sans font-medium">{video.author}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
                  <span>{video.views}</span>
                  <span>•</span>
                  <span>{video.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
