'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

interface SortSessionItem {
  id: string;
  workerSession: string;
  totalImages: number;
  status: string;
  colorCounts: Record<string, number> | null;
  creditsUsed: number;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

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
  recentSessions: SortSessionItem[];
}

const RETENTION_LABELS: Record<string, string> = {
  FREE: '24 hours',
  STARTER: '7 days',
  PRO: '30 days',
  ENTERPRISE: '90 days',
};

function timeUntilExpiry(expiresAt: string | null): { label: string; urgent: boolean } {
  if (!expiresAt) return { label: 'No expiry', urgent: false };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'Expired', urgent: true };
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return { label: `${days}d ${hours % 24}h left`, urgent: days < 1 };
  if (hours > 0) return { label: `${hours}h left`, urgent: hours < 6 };
  const mins = Math.floor(ms / (1000 * 60));
  return { label: `${mins}m left`, urgent: true };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/dashboard').then(r => r.json()).then(setData).catch(console.error);
    }
  }, [status]);

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session and its files? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/sort/sessions/${id}`, { method: 'DELETE' });
      if (res.ok && data) {
        setData({ ...data, recentSessions: data.recentSessions.filter(s => s.id !== id) });
      }
    } catch (e) { console.error('Delete failed:', e); }
    setDeleting(null);
  };

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

        {/* Data retention info */}
        <div className="glass-card rounded-2xl p-4 mb-6 flex items-center gap-3 text-xs">
          <i className="fas fa-database text-racing-500" />
          <span className="text-white/50">
            Your <strong className="text-white/70">{data.plan}</strong> plan keeps sorted files for <strong className="text-white/70">{RETENTION_LABELS[data.plan] || '24 hours'}</strong>.
            {data.plan === 'FREE' && <span className="text-racing-400 ml-1">Upgrade for longer storage.</span>}
          </span>
        </div>

        {/* Recent sessions */}
        <div className="glass-card rounded-3xl p-6">
          <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
            <i className="fas fa-history text-racing-500" />
            Recent Sessions ({data.recentSessions.length})
          </h2>
          {data.recentSessions.length > 0 ? (
            <div className="space-y-3">
              {data.recentSessions.map(s => {
                const expiry = timeUntilExpiry(s.expiresAt);
                return (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                    <Link href={`/sort/session/${s.id}`} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'completed' ? 'bg-green-500' : s.status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold group-hover:text-racing-400 transition-colors">{s.totalImages} images</div>
                        <div className="text-xs text-white/30">{new Date(s.createdAt).toLocaleDateString()} &middot; {s.creditsUsed} credits</div>
                      </div>
                      <i className="fas fa-chevron-right text-[10px] text-white/10 group-hover:text-white/30 transition-colors ml-auto sm:hidden" />
                    </Link>

                    {s.colorCounts && (
                      <Link href={`/sort/session/${s.id}`} className="flex flex-wrap gap-1 pl-6 sm:pl-0 cursor-pointer">
                        {Object.entries(s.colorCounts as Record<string, number>).slice(0, 4).map(([color, count]) => (
                          <span key={color} className="text-[9px] bg-white/5 rounded px-1.5 py-0.5 text-white/40">
                            {color}: {count}
                          </span>
                        ))}
                      </Link>
                    )}

                    <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                      {/* Retention badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${expiry.urgent ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-white/30'}`}>
                        <i className="fas fa-clock mr-1" />{expiry.label}
                      </span>

                      {/* Open */}
                      <Link href={`/sort/session/${s.id}`} className="text-white/20 hover:text-racing-400 transition-colors p-1" title="Open session">
                        <i className="fas fa-external-link-alt text-xs" />
                      </Link>

                      {/* Download */}
                      {s.status === 'completed' && !expiry.label.includes('Expired') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`/api/worker/download/${s.workerSession}`, '_blank'); }}
                          className="text-white/20 hover:text-racing-400 transition-colors p-1"
                          title="Download sorted ZIP"
                        >
                          <i className="fas fa-download text-xs" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                        disabled={deleting === s.id}
                        className="text-white/20 hover:text-red-400 transition-colors p-1 disabled:opacity-30"
                        title="Delete session and files"
                      >
                        <i className={`fas ${deleting === s.id ? 'fa-spinner fa-spin' : 'fa-trash'} text-xs`} />
                      </button>
                    </div>
                  </div>
                );
              })}
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
