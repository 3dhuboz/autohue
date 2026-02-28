export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <header className="border-b border-white/5 glass-card-solid">
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 max-w-6xl mt-10">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-white/[0.03] rounded animate-pulse mb-10" />

        {/* Stats skeleton */}
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-5">
              <div className="h-3 w-20 bg-white/5 rounded animate-pulse mb-3" />
              <div className="h-7 w-16 bg-white/[0.03] rounded animate-pulse mb-2" />
              <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
            </div>
          ))}
        </div>

        {/* Sessions skeleton */}
        <div className="glass-card rounded-3xl p-6">
          <div className="h-5 w-36 bg-white/5 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-white/[0.02] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
