'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

interface AccountData {
  plan: string;
  credits: { monthlyLimit: number; used: number; extraCredits: number; remaining: number; isUnlimited: boolean };
  stats: { totalImages: number; totalSessions: number };
  recentSessions: unknown[];
}

const PLAN_NAMES: Record<string, { label: string; images: string }> = {
  FREE: { label: 'Free', images: '10' },
  STARTER: { label: 'Starter', images: '500' },
  PRO: { label: 'Pro', images: '5,000' },
  ENTERPRISE: { label: 'Enterprise', images: 'Unlimited' },
};

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/dashboard').then(r => r.json()).then(d => {
        setData(d);
        setProfileName(session?.user?.name || '');
      }).catch(console.error);
    }
  }, [status, session]);

  const handleUpgrade = async (plan: string) => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Upgrade error:', err);
    }
    setUpgrading(false);
  };

  const handleBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Portal error:', err);
    }
    setPortalLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
  };

  if (status === 'loading' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-racing-500 text-3xl" />
      </div>
    );
  }

  const planInfo = PLAN_NAMES[data.plan] || PLAN_NAMES.FREE;
  const remainingDisplay = data.credits.isUnlimited ? 'Unlimited' : data.credits.remaining;

  return (
    <div className="min-h-screen">
      <NavBar />

      <div className="container mx-auto px-6 max-w-4xl mt-10">
        <h1 className="text-3xl font-heading font-black mb-2">Account Settings</h1>
        <p className="text-white/40 text-sm mb-10">Manage your subscription, credits, and profile</p>

        <div className="space-y-6">
          {/* Current plan */}
          <div className="glass-card rounded-3xl p-6 red-accent-top">
            <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
              <i className="fas fa-crown text-racing-500" />
              Current Plan
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-heading font-black text-white">{planInfo.label}</div>
                <div className="text-xs text-white/30 mt-1">{planInfo.images} images/month</div>
              </div>
              <div className="flex gap-2">
                {data.plan !== 'FREE' && (
                  <button onClick={handleBillingPortal} disabled={portalLoading} className="btn-carbon px-5 py-2.5 rounded-xl text-sm">
                    {portalLoading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-credit-card mr-1" />Manage Billing</>}
                  </button>
                )}
                {data.plan !== 'ENTERPRISE' && (
                  <button onClick={() => handleUpgrade(data.plan === 'FREE' ? 'STARTER' : data.plan === 'STARTER' ? 'PRO' : 'ENTERPRISE')} disabled={upgrading} className="btn-racing px-5 py-2.5 rounded-xl text-sm">
                    {upgrading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-arrow-up mr-1" />Upgrade</>}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Credits */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
              <i className="fas fa-coins text-yellow-500" />
              Image Credits
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-heading font-black text-white">
                  {remainingDisplay} <span className="text-sm text-white/20 font-normal">remaining</span>
                </div>
                <div className="text-xs text-white/30 mt-1">
                  {data.credits.used} used this period
                  {data.credits.extraCredits > 0 && ` · ${data.credits.extraCredits} extra credits`}
                </div>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
              <i className="fas fa-user text-white/40" />
              Profile
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-white/30 mb-2 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 mb-2 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={session?.user?.email || ''}
                  readOnly
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/40 cursor-not-allowed"
                />
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="btn-carbon mt-4 px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
              {saving ? <i className="fas fa-spinner fa-spin" /> : saved ? <><i className="fas fa-check text-green-400" /> Saved!</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
