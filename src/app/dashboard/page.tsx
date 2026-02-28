'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

interface DashboardData {
  plan: string;
  credits: {
    monthlyLimit: number;
    used: number;
    extraCredits: number;
    remaining: number;
    isUnlimited: boolean;
  };
  stats: { totalImages: number; totalSessions: number };
  recentSessions: Array<{
    id: string;
    totalImages: number;
    status: string;
    colorCounts: Record<string, number> | null;
    creditsUsed: number;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/dashboard').then(r => r.json()).then(setData).catch(console.error);
    }
  }, [status]);

  if (status === 'loading' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-racing-500 text-3xl" />
      </div>
    );
  }

  const timeSavedMin = Math.round((data.stats.totalImages * 20) / 60);
  const creditDisplay = data.credits.isUnlimited ? 'Unlimited' : `${data.credits.used} / ${data.credits.monthlyLimit}`;

  return (
    <div className="min-h-screen">
      <NavBar />

      <div className="container mx-auto px-6 max-w-6xl mt-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-heading font-black mb-1">
              Welcome back, <span className="text-racing-500">{session?.user?.name || 'Racer'}</span>
            </h1>
            <p className="text-white/40 text-sm">
              <span className="inline-flex items-center gap-1.5 bg-racing-600/10 border border-racing-600/20 px-2.5 py-0.5 rounded-full text-racing-400 text-xs font-bold">
                {data.plan}
              </span>
            </p>
          </div>
          <Link href="/sort" className="btn-racing px-6 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <i className="fas fa-plus" /> New Sort
          </Link>
        </div>

        {/* Usage stats */}
        <div className="grid sm:grid-cols-3 gap-5 mb-10 stagger">
          <div className="glass-card rounded-2xl p-6 red-accent-top">
            <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2">Credits Used</div>
            <div className="text-3xl font-heading font-black text-white">{creditDisplay}</div>
            {!data.credits.isUnlimited && data.credits.monthlyLimit > 0 && (
              <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-racing-600 to-racing-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (data.credits.used / data.credits.monthlyLimit) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2">Total Images Sorted</div>
            <div className="text-3xl font-heading font-black text-white">{data.stats.totalImages.toLocaleString()}</div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2">Time Saved</div>
            <div className="text-3xl font-heading font-black text-racing-500">
              {timeSavedMin >= 60 ? `${Math.floor(timeSavedMin / 60)}h ${timeSavedMin % 60}m` : `${timeSavedMin}m`}
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="glass-card rounded-3xl p-6">
          <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
            <i className="fas fa-history text-racing-500" />
            Recent Sessions ({data.recentSessions.length})
          </h2>
          {data.recentSessions.length > 0 ? (
            <div className="space-y-3">
              {data.recentSessions.map(s => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-4 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'completed' ? 'bg-green-500' : s.status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                    <div>
                      <div className="text-sm font-bold">{s.totalImages} images</div>
                      <div className="text-xs text-white/30">{new Date(s.createdAt).toLocaleDateString()} &middot; {s.creditsUsed} credits</div>
                    </div>
                  </div>
                  {s.colorCounts && (
                    <div className="flex flex-wrap gap-1 pl-6 sm:pl-0">
                      {Object.entries(s.colorCounts as Record<string, number>).slice(0, 5).map(([color, count]) => (
                        <span key={color} className="text-[9px] bg-white/5 rounded px-1.5 py-0.5 text-white/40">
                          {color}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/20">
              <i className="fas fa-folder-open text-4xl mb-3 block" />
              <p className="text-sm">No sorting sessions yet</p>
              <Link href="/sort" className="btn-racing inline-block mt-4 px-6 py-2.5 rounded-xl text-sm">
                Start Your First Sort
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
