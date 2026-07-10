import PageWrapper from '@/components/layout/PageWrapper';

export default function SocialFeedPage() {
  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Social Feed
            </h1>
            <p className="text-body text-text-secondary font-sans">
              Connect, share milestones, and network with other prep partners.
            </p>
          </div>
        </div>

        {/* Placeholder Timeline Feed */}
        <div className="flex flex-col gap-4 max-w-2xl">
          {/* Tweet Composer Placeholder */}
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent font-sans">
                U
              </div>
              <textarea
                placeholder="What did you learn today? Share a milestone or post..."
                className="flex-1 bg-transparent border-0 resize-none text-body text-text-primary focus:outline-none focus:ring-0 placeholder:text-text-muted h-20 pt-1 font-sans"
              />
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle/50 pt-3">
              <div className="flex items-center gap-2 text-text-muted">
                <button className="p-2 hover:text-accent hover:bg-bg-overlay rounded-md transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <button className="p-2 hover:text-accent hover:bg-bg-overlay rounded-md transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </button>
              </div>
              <button className="px-4 py-1.5 bg-accent text-text-inverse rounded-md text-caption font-sans font-medium hover:bg-accent/90 transition-colors">
                Post
              </button>
            </div>
          </div>

          {/* Dummy Post 1 */}
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E65100]/20 text-[#E65100] flex items-center justify-center font-bold font-sans">
                  JD
                </div>
                <div>
                  <h4 className="text-body text-text-primary font-sans font-medium">Jane Doe</h4>
                  <p className="text-[11px] text-text-muted font-sans">Software Engineer @ Google • 2h ago</p>
                </div>
              </div>
              <button className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>
            <p className="text-body text-text-secondary font-sans leading-relaxed">
              Just completed my 30-day coding streak on PrepSync! Reaching an overall readiness score of 87%. Big thanks to my practice partners for the amazing System Design reviews! 🚀
            </p>
            <div className="flex items-center gap-6 border-t border-border-subtle/50 pt-3 text-caption text-text-muted font-sans">
              <button className="flex items-center gap-1.5 hover:text-[#D32F2F] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>24</span>
              </button>
              <button className="flex items-center gap-1.5 hover:text-accent transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <span>6</span>
              </button>
              <button className="flex items-center gap-1.5 hover:text-accent transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <span>Repost</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
