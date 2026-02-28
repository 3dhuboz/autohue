export default function AccountLoading() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5 glass-card-solid">
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </header>
      <div className="container mx-auto px-6 max-w-4xl mt-10">
        <div className="h-8 w-52 bg-white/5 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-white/[0.03] rounded animate-pulse mb-10" />
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card rounded-3xl p-6">
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse mb-4" />
              <div className="h-6 w-20 bg-white/[0.03] rounded animate-pulse mb-3" />
              <div className="h-3 w-full bg-white/5 rounded animate-pulse mb-2" />
              <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
