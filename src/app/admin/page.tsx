'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

interface AdminStats {
  totalUsers: number;
  activeSubs: number;
  totalSortSessions: number;
  totalImagesSorted: number;
  monthlyRevenue: number;
  recentUsers: Array<{ id: string; email: string; name: string | null; createdAt: string }>;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  plan: string;
  status: string;
  creditsUsed: number;
  creditsLimit: number;
  sortSessions: number;
  createdAt: string;
}

interface Trial {
  id: string;
  expiresAt: string;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

type Tab = 'overview' | 'users' | 'trials';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [trialEmail, setTrialEmail] = useState('');
  const [trialName, setTrialName] = useState('');
  const [trialNote, setTrialNote] = useState('');
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialResult, setTrialResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') {
      const role = session?.user?.role;
      if (role !== 'ADMIN') router.push('/dashboard');
    }
  }, [status, session, router]);

  const loadStats = useCallback(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(console.error);
  }, []);

  const loadUsers = useCallback((page: number, search?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    fetch(`/api/admin/users?${params}`).then(r => r.json()).then(d => {
      setUsers(d.users);
      setUsersTotal(d.total);
    }).catch(console.error);
  }, []);

  const loadTrials = useCallback(() => {
    fetch('/api/admin/trials').then(r => r.json()).then(d => setTrials(d.trials)).catch(console.error);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadStats();
      loadUsers(1);
      loadTrials();
    }
  }, [status, loadStats, loadUsers, loadTrials]);

  const handleChangePlan = async (userId: string, plan: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    loadUsers(usersPage, searchQuery);
  };

  const handleChangeRole = async (userId: string, role: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    loadUsers(usersPage, searchQuery);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user permanently?')) return;
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    loadUsers(usersPage, searchQuery);
    loadStats();
  };

  const handleCreateTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialLoading(true);
    setTrialResult(null);
    try {
      const res = await fetch('/api/admin/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trialEmail, name: trialName, note: trialNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setTrialResult({ email: data.email, tempPassword: data.tempPassword });
        setTrialEmail('');
        setTrialName('');
        setTrialNote('');
        loadTrials();
        loadStats();
      }
    } catch (err) {
      console.error('Trial creation error:', err);
    }
    setTrialLoading(false);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setUsersPage(1);
    loadUsers(1, q);
  };

  if (status === 'loading' || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-racing-500 text-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />

      <div className="container mx-auto px-6 max-w-6xl mt-10">
        <h1 className="text-3xl font-heading font-black mb-2">Admin Panel</h1>
        <p className="text-white/40 text-sm mb-6">Manage users, subscriptions, and platform settings</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/[0.02] rounded-xl p-1 w-fit border border-white/5">
          {([['overview', 'fa-chart-bar', 'Overview'], ['users', 'fa-users', 'Users'], ['trials', 'fa-key', 'Trials']] as [Tab, string, string][]).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${tab === key ? 'bg-racing-600/20 text-racing-400' : 'text-white/30 hover:text-white/60'}`}
            >
              <i className={`fas ${icon}`} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === 'overview' && (
          <>
            <div className="grid sm:grid-cols-4 gap-4 mb-10 stagger">
              <div className="glass-card rounded-2xl p-5 red-accent-top">
                <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-1">Total Users</div>
                <div className="text-2xl font-heading font-black text-white">{stats.totalUsers}</div>
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-1">Active Subs</div>
                <div className="text-2xl font-heading font-black text-white">{stats.activeSubs}</div>
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-1">Revenue (MTD)</div>
                <div className="text-2xl font-heading font-black text-green-400">${stats.monthlyRevenue}</div>
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-1">Images Sorted</div>
                <div className="text-2xl font-heading font-black text-racing-500">{stats.totalImagesSorted.toLocaleString()}</div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
                <i className="fas fa-user-plus text-racing-500" /> Recent Signups
              </h2>
              {stats.recentUsers.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/5 text-sm">
                      <div>
                        <span className="font-bold text-white">{u.name || 'No name'}</span>
                        <span className="text-white/30 ml-2">{u.email}</span>
                      </div>
                      <span className="text-xs text-white/20">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/20 text-sm text-center py-6">No users yet</p>
              )}
            </div>
          </>
        )}

        {/* ═══ USERS TAB ═══ */}
        {tab === 'users' && (
          <>
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
              />
            </div>
            <div className="glass-card rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-[10px] font-bold text-white/30 uppercase tracking-wider">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Credits</th>
                      <th className="px-4 py-3">Sessions</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{u.name || '—'}</div>
                          <div className="text-[10px] text-white/30">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.plan}
                            onChange={e => handleChangePlan(u.id, e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                            title="Change plan"
                          >
                            <option value="FREE">Free</option>
                            <option value="STARTER">Starter</option>
                            <option value="PRO">Pro</option>
                            <option value="ENTERPRISE">Enterprise</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={e => handleChangeRole(u.id, e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                            title="Change role"
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-white/40">{u.creditsUsed}/{u.creditsLimit === -1 ? '∞' : u.creditsLimit}</td>
                        <td className="px-4 py-3 text-white/40">{u.sortSessions}</td>
                        <td className="px-4 py-3 text-white/30 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteUser(u.id)} className="text-red-500/50 hover:text-red-400 transition-colors" title="Delete user">
                            <i className="fas fa-trash text-xs" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usersTotal > 15 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <span className="text-xs text-white/30">{usersTotal} users total</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setUsersPage(p => p - 1); loadUsers(usersPage - 1, searchQuery); }}
                      disabled={usersPage <= 1}
                      className="text-xs text-white/30 hover:text-white disabled:opacity-30 px-2 py-1"
                      title="Previous page"
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    <span className="text-xs text-white/40">Page {usersPage}</span>
                    <button
                      onClick={() => { setUsersPage(p => p + 1); loadUsers(usersPage + 1, searchQuery); }}
                      disabled={usersPage * 15 >= usersTotal}
                      className="text-xs text-white/30 hover:text-white disabled:opacity-30 px-2 py-1"
                      title="Next page"
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ TRIALS TAB ═══ */}
        {tab === 'trials' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create trial */}
            <div className="glass-card rounded-3xl p-6 red-accent-top">
              <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
                <i className="fas fa-plus-circle text-racing-500" /> Create 12hr Trial
              </h2>
              <form onSubmit={handleCreateTrial} className="space-y-3">
                <input
                  type="email"
                  value={trialEmail}
                  onChange={e => setTrialEmail(e.target.value)}
                  placeholder="prospect@email.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  value={trialName}
                  onChange={e => setTrialName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  value={trialNote}
                  onChange={e => setTrialNote(e.target.value)}
                  placeholder="Note (e.g. 'Demo for ABC Motors')"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
                />
                <button type="submit" disabled={trialLoading} className="btn-racing w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  {trialLoading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-key" /> Issue Trial Account</>}
                </button>
              </form>

              {trialResult && (
                <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm">
                  <div className="font-bold text-green-400 mb-1">Trial Created!</div>
                  <div className="text-white/60">Email: <span className="font-mono text-white">{trialResult.email}</span></div>
                  <div className="text-white/60">Password: <span className="font-mono text-white">{trialResult.tempPassword}</span></div>
                  <div className="text-xs text-white/30 mt-2">Expires in 12 hours. Share these credentials securely.</div>
                </div>
              )}
            </div>

            {/* Active trials */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
                <i className="fas fa-clock text-yellow-500" /> Active Trials ({trials.length})
              </h2>
              {trials.length > 0 ? (
                <div className="space-y-2">
                  {trials.map(t => {
                    const expired = new Date(t.expiresAt) < new Date();
                    return (
                      <div key={t.id} className="py-2.5 px-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-white">{t.user.email}</span>
                            {t.note && <span className="text-xs text-white/30 ml-2">— {t.note}</span>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${expired ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                            {expired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/20 mt-1">
                          Expires: {new Date(t.expiresAt).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/20 text-sm text-center py-6">No trial accounts yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
