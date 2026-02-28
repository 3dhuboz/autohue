'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import Link from 'next/link';

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

type Tab = 'overview' | 'users' | 'trials' | 'devtools';

interface StripeCheck {
  stripeKey: { set: boolean; valid: boolean; mode?: string };
  webhookSecret: { set: boolean };
  prices: Record<string, { set: boolean; valid: boolean; amount?: number; interval?: string }>;
  resendKey: { set: boolean };
}

function DevToolsInline() {
  const [stripeCheck, setStripeCheck] = useState<StripeCheck | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailType, setEmailType] = useState('test');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [workerHealth, setWorkerHealth] = useState<Record<string, unknown> | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);

  const runStripeCheck = async () => {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/dev/stripe-check');
      const data = await res.json();
      setStripeCheck(data);
    } catch { setStripeCheck(null); }
    setStripeLoading(false);
  };

  const sendTestEmail = async () => {
    if (!emailTo) return;
    setEmailLoading(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/dev/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: emailType, to: emailTo }),
      });
      const data = await res.json();
      setEmailResult({ success: res.ok, message: res.ok ? `Email sent! ID: ${data.id}` : (data.error || 'Failed') });
    } catch {
      setEmailResult({ success: false, message: 'Network error' });
    }
    setEmailLoading(false);
  };

  const checkWorker = async () => {
    setWorkerLoading(true);
    try {
      const res = await fetch('/api/worker/health');
      const data = await res.json();
      setWorkerHealth(data);
    } catch { setWorkerHealth({ error: 'Worker unreachable' }); }
    setWorkerLoading(false);
  };

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
  );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Stripe Config Check */}
      <div className="glass-card rounded-3xl p-6 red-accent-top">
        <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
          <i className="fab fa-stripe text-purple-400" /> Stripe Configuration
        </h2>
        <button onClick={runStripeCheck} disabled={stripeLoading} className="btn-carbon w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-4">
          {stripeLoading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-plug" /> Check Stripe Config</>}
        </button>
        {stripeCheck && (
          <div className="space-y-2 text-sm">
            <div><StatusDot ok={stripeCheck.stripeKey.valid} /> API Key {stripeCheck.stripeKey.valid ? `✓ (${stripeCheck.stripeKey.mode} mode)` : '✗ Invalid'}</div>
            <div><StatusDot ok={stripeCheck.webhookSecret.set} /> Webhook Secret {stripeCheck.webhookSecret.set ? '✓ Set' : '✗ Missing'}</div>
            {Object.entries(stripeCheck.prices).map(([plan, info]) => (
              <div key={plan}><StatusDot ok={info.valid} /> {plan}: {info.valid ? `✓ $${((info.amount || 0)/100).toFixed(0)}/${info.interval}` : info.set ? '✗ Invalid ID' : '✗ Not set'}</div>
            ))}
            <div><StatusDot ok={stripeCheck.resendKey.set} /> Resend API Key {stripeCheck.resendKey.set ? '✓ Set' : '✗ Missing'}</div>
          </div>
        )}
      </div>

      {/* Email Test */}
      <div className="glass-card rounded-3xl p-6">
        <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
          <i className="fas fa-envelope text-blue-400" /> Email Service (Resend)
        </h2>
        <div className="space-y-3">
          <input
            type="email"
            value={emailTo}
            onChange={e => setEmailTo(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-racing-500"
          />
          <select
            value={emailType}
            onChange={e => setEmailType(e.target.value)}
            aria-label="Email template"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-racing-500"
          >
            <option value="test" className="bg-gray-900">Test Email</option>
            <option value="welcome" className="bg-gray-900">Welcome</option>
            <option value="subscription" className="bg-gray-900">Subscription Confirmation</option>
            <option value="sort-complete" className="bg-gray-900">Sort Complete</option>
            <option value="payment-failed" className="bg-gray-900">Payment Failed</option>
          </select>
          <button onClick={sendTestEmail} disabled={emailLoading || !emailTo} className="btn-racing w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            {emailLoading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Send Test Email</>}
          </button>
        </div>
        {emailResult && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-xl ${emailResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {emailResult.message}
          </div>
        )}
      </div>

      {/* Worker Health */}
      <div className="glass-card rounded-3xl p-6">
        <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
          <i className="fas fa-server text-green-400" /> Worker / ONNX Engine
        </h2>
        <button onClick={checkWorker} disabled={workerLoading} className="btn-carbon w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-4">
          {workerLoading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-heartbeat" /> Check Worker Health</>}
        </button>
        {workerHealth && (
          <div className="space-y-2 text-sm">
            {Object.entries(workerHealth).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-white/40">{key}</span>
                <span className={`font-mono text-xs ${val === 'loaded' || val === 'ok' || val === true ? 'text-green-400' : typeof val === 'string' && (val.includes('NOT') || val.includes('error')) ? 'text-red-400' : 'text-white/60'}`}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Reference */}
      <div className="glass-card rounded-3xl p-6">
        <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
          <i className="fas fa-info-circle text-yellow-400" /> Quick Reference
        </h2>
        <div className="space-y-3 text-xs">
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="font-bold text-white/50 mb-2">Billing Plans (Recurring Monthly)</div>
            <table className="w-full">
              <thead><tr className="text-white/30"><th className="text-left py-1">Plan</th><th className="text-right">Price</th><th className="text-right">Credits</th><th className="text-right">Retention</th></tr></thead>
              <tbody className="text-white/50">
                <tr><td className="py-0.5">Starter</td><td className="text-right">$29</td><td className="text-right">500</td><td className="text-right">7 days</td></tr>
                <tr><td className="py-0.5">Pro</td><td className="text-right">$79</td><td className="text-right">5,000</td><td className="text-right">30 days</td></tr>
                <tr><td className="py-0.5">Enterprise</td><td className="text-right">$199</td><td className="text-right">Unlimited</td><td className="text-right">90 days</td></tr>
              </tbody>
            </table>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <div className="font-bold text-white/50 mb-1">Webhook Events Handled</div>
            <div className="text-white/40 space-y-0.5">
              <div>• checkout.session.completed → activate sub + email</div>
              <div>• customer.subscription.updated → sync status</div>
              <div>• customer.subscription.deleted → downgrade to free</div>
              <div>• invoice.payment_failed → mark past due + email</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
          {([['overview', 'fa-chart-bar', 'Overview'], ['users', 'fa-users', 'Users'], ['trials', 'fa-key', 'Trials'], ['devtools', 'fa-tools', 'Dev Tools']] as [Tab, string, string][]).map(([key, icon, label]) => (
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
        {/* ═══ DEV TOOLS TAB ═══ */}
        {tab === 'devtools' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-sm">Email and payment API settings, testing, and verification.</p>
              <Link href="/admin/dev-tools" className="btn-racing px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
                <i className="fas fa-external-link-alt" /> Open Full Dev Tools
              </Link>
            </div>
            <DevToolsInline />
          </div>
        )}

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
