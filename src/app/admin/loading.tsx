export default function AdminLoading() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5 glass-card-solid">
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-12 bg-racing-600/10 rounded-full animate-pulse" />
          </div>
        </div>
      </header>
      <div className="container mx-auto px-6 max-w-6xl mt-10">
        <div className="h-8 w-36 bg-white/5 rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-white/[0.03] rounded animate-pulse mb-10" />
        <div className="grid sm:grid-cols-4 gap-4 mb-10">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card rounded-2xl p-5">
              <div className="h-3 w-20 bg-white/5 rounded animate-pulse mb-3" />
              <div className="h-7 w-12 bg-white/[0.03] rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-3xl p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-white/[0.02] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
