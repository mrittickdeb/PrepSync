import PageWrapper from '@/components/layout/PageWrapper';

export default function ExploreCommunitiesPage() {
  const dummyCommunities = [
    { name: 'System Design Wizards', members: '1.2k members', desc: 'Deep dive into microservices, caching strategies, load balancing, and distributed databases.' },
    { name: 'LeetCode Grinders', members: '2.5k members', desc: 'Daily algorithmic challenges, optimal solutions discussions, and patterns review.' },
    { name: 'Rustacean Study Room', members: '820 members', desc: 'Learning Rust safety guidelines, memory management, and preparing for Rust roles.' },
    { name: 'Frontend Tech & UI', members: '1.8k members', desc: 'React, Next.js, CSS grid, tailwind systems, bundle size optimization, and mock UI interviews.' },
  ];

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <h1 className="text-display text-text-primary font-sans font-semibold mb-1">
              Explore Communities
            </h1>
            <p className="text-body text-text-secondary font-sans">
              Discover and join topic-specific study groups created by members.
            </p>
          </div>
          <button className="px-4 py-2 bg-accent text-text-inverse rounded-md text-caption font-sans font-medium hover:bg-accent/90 transition-colors">
            + Create Community
          </button>
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dummyCommunities.map((comm) => (
            <div key={comm.name} className="bg-bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-accent/40 transition-colors">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-heading text-text-primary font-sans font-semibold">{comm.name}</h3>
                  <span className="text-[11px] bg-accent-dim text-accent px-2 py-0.5 rounded font-mono font-medium">{comm.members}</span>
                </div>
                <p className="text-caption text-text-secondary font-sans leading-relaxed">{comm.desc}</p>
              </div>
              <button className="w-full py-2 bg-bg-elevated hover:bg-bg-overlay border border-border-subtle text-text-primary rounded-md text-caption font-sans font-medium transition-colors">
                Join Community
              </button>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
