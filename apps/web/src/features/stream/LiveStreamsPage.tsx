import PageWrapper from '@/components/layout/PageWrapper';

export default function LiveStreamsPage() {
  const dummyStreams = [
    { title: 'Studying for L5 Backend Interview (Co-working)', viewers: '42 watching', streamer: 'Alex_Dev', status: 'live' },
    { title: 'Solving LeetCode Hard Patterns Live!', viewers: '18 watching', streamer: 'AlgoMaster', status: 'live' },
    { title: 'Interactive System Design Review: WhatsApp Architecture', viewers: '78 watching', streamer: 'SeniorSWE_Review', status: 'live' },
  ];

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Live Streams
            </h1>
            <p className="text-body text-text-secondary font-sans">
              Join active study broadcasts, pair programming sessions, or live discussions.
            </p>
          </div>
          <button className="px-4 py-2 bg-[#D32F2F] text-text-inverse rounded-md text-caption font-sans font-medium hover:bg-[#D32F2F]/90 transition-colors">
            🔴 Go Live
          </button>
        </div>

        {/* Live Streams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dummyStreams.map((stream) => (
            <div key={stream.title} className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden group cursor-pointer hover:border-accent/40 transition-colors flex flex-col justify-between">
              {/* Stream Video Placeholder */}
              <div className="aspect-video bg-black flex items-center justify-center relative">
                <span className="absolute top-2 left-2 bg-[#D32F2F] text-text-inverse px-1.5 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  Live
                </span>
                <span className="absolute top-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-mono text-text-primary font-medium">
                  {stream.viewers}
                </span>
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
                    <polygon points="12 7 17 12 12 17 12 7" />
                  </svg>
                </div>
              </div>
              {/* Stream Details */}
              <div className="p-4 flex flex-col gap-1.5">
                <h4 className="text-body text-text-primary font-sans font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                  {stream.title}
                </h4>
                <div className="flex items-center justify-between text-caption text-text-secondary font-sans font-medium">
                  <span>@{stream.streamer}</span>
                  <span className="text-[10px] text-accent">Join Stream →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
