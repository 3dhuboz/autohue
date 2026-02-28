'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

interface Check {
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

interface StripeCheckResult {
  overall: string;
  checks: Record<string, Check>;
  env_summary: Record<string, string>;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export default function DevToolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stripeCheck, setStripeCheck] = useState<StripeCheckResult | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailType, setEmailType] = useState('test');
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) setEmailTo(session.user.email);
  }, [session]);

  const runStripeCheck = async () => {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/dev/stripe-check');
      const data = await res.json();
      setStripeCheck(data);
    } catch (err) {
      setStripeCheck({ overall: 'error', checks: { fetch: { status: 'error', detail: (err as Error).message } }, env_summary: {} });
    }
    setStripeLoading(false);
  };

  const sendEmail = async () => {
    setEmailLoading(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/dev/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: emailType, to: emailTo }),
      });
      const data = await res.json();
      setEmailResult(data);
    } catch (err) {
      setEmailResult({ success: false, error: (err as Error).message });
    }
    setEmailLoading(false);
  };

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><i className="fas fa-spinner fa-spin text-racing-500 text-3xl" /></div>;
  }

  const statusIcon = (s: string) => {
    if (s === 'ok') return <i className="fas fa-check-circle text-green-400" />;
    if (s === 'warning') return <i className="fas fa-exclamation-triangle text-amber-400" />;
    return <i className="fas fa-times-circle text-red-400" />;
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="container mx-auto px-6 max-w-4xl mt-10 space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-black mb-1">
            <i className="fas fa-tools text-racing-500 mr-2" />
            Dev Tools
          </h1>
          <p className="text-white/40 text-sm">Verify email and payment integrations. Admin only.</p>
        </div>

        {/* ═══ STRIPE / PAYMENT CHECK ═══ */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-lg flex items-center gap-2">
              <i className="fab fa-stripe text-purple-400 text-xl" />
              Stripe & Payment Config
            </h2>
            <button
              onClick={runStripeCheck}
              disabled={stripeLoading}
              className="btn-racing px-5 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              {stripeLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-sync-alt" />}
              {stripeLoading ? 'Checking...' : 'Run Check'}
            </button>
          </div>

          {!stripeCheck && !stripeLoading && (
            <p className="text-white/30 text-sm text-center py-8">Click &quot;Run Check&quot; to verify your Stripe configuration, price IDs, webhook secret, and recurring billing setup.</p>
          )}

          {stripeCheck && (
            <div className="space-y-4">
              {/* Overall status */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                stripeCheck.overall === 'ok' ? 'bg-green-500/10 text-green-400' :
                stripeCheck.overall === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {statusIcon(stripeCheck.overall)}
                {stripeCheck.overall === 'ok' ? 'All checks passed!' :
                 stripeCheck.overall === 'warning' ? 'Some warnings detected' :
                 'Configuration errors found'}
              </div>

              {/* Individual checks */}
              <div className="space-y-2">
                {Object.entries(stripeCheck.checks).map(([key, check]) => (
                  <div key={key} className="flex items-start gap-3 bg-white/[0.02] rounded-xl px-4 py-3">
                    <div className="mt-0.5">{statusIcon(check.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-white/40 mb-0.5">{key}</div>
                      <div className="text-sm text-white/70">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Env summary */}
              <details className="mt-4">
                <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                  <i className="fas fa-eye mr-1" /> Environment variables
                </summary>
                <div className="mt-2 bg-black/30 rounded-xl p-4 font-mono text-[11px] space-y-1">
                  {Object.entries(stripeCheck.env_summary).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-white/30 shrink-0">{key}:</span>
                      <span className={val === 'NOT SET' ? 'text-red-400' : 'text-green-400'}>{val}</span>
                    </div>
                  ))}
                </div>
              </details>

              {/* Stripe setup guide */}
              <details className="mt-2">
                <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                  <i className="fas fa-book mr-1" /> Stripe recurring billing setup guide
                </summary>
                <div className="mt-2 bg-black/30 rounded-xl p-4 text-xs text-white/50 space-y-2">
                  <p><strong className="text-white/70">1.</strong> Go to <a href="https://dashboard.stripe.com/test/products" target="_blank" rel="noopener noreferrer" className="text-racing-400 underline">Stripe Dashboard → Products</a></p>
                  <p><strong className="text-white/70">2.</strong> Create a product for each plan (Starter, Pro, Enterprise)</p>
                  <p><strong className="text-white/70">3.</strong> Add a <strong>recurring price</strong> (monthly) to each: $29, $79, $199</p>
                  <p><strong className="text-white/70">4.</strong> Copy each price ID (starts with <code className="text-racing-400">price_</code>) into your <code className="text-racing-400">.env.local</code></p>
                  <p><strong className="text-white/70">5.</strong> Set up a webhook at <a href="https://dashboard.stripe.com/test/webhooks" target="_blank" rel="noopener noreferrer" className="text-racing-400 underline">Stripe Webhooks</a> pointing to <code className="text-racing-400">{'{your-domain}'}/api/stripe/webhook</code></p>
                  <p><strong className="text-white/70">6.</strong> Events to listen for: <code className="text-racing-400">checkout.session.completed</code>, <code className="text-racing-400">customer.subscription.updated</code>, <code className="text-racing-400">customer.subscription.deleted</code>, <code className="text-racing-400">invoice.payment_failed</code></p>
                  <p><strong className="text-white/70">7.</strong> For local dev, use <code className="text-racing-400">stripe listen --forward-to localhost:3002/api/stripe/webhook</code></p>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* ═══ EMAIL TEST ═══ */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2 mb-6">
            <i className="fas fa-envelope text-blue-400" />
            Email Service (Resend)
          </h2>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-white/30 uppercase tracking-wider block mb-2">Recipient</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-racing-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-white/30 uppercase tracking-wider block mb-2">Email Template</label>
                <select
                  value={emailType}
                  onChange={e => setEmailType(e.target.value)}
                  aria-label="Email template"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-racing-500"
                >
                  <option value="test" className="bg-gray-900">Test Email (connection check)</option>
                  <option value="welcome" className="bg-gray-900">Welcome Email</option>
                  <option value="subscription" className="bg-gray-900">Subscription Confirmation</option>
                  <option value="sort-complete" className="bg-gray-900">Sort Complete Notification</option>
                  <option value="payment-failed" className="bg-gray-900">Payment Failed Alert</option>
                </select>
              </div>
            </div>

            <button
              onClick={sendEmail}
              disabled={emailLoading || !emailTo}
              className="btn-racing px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {emailLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
              {emailLoading ? 'Sending...' : 'Send Test Email'}
            </button>

            {emailResult && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
                emailResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {emailResult.success ? (
                  <>
                    <i className="fas fa-check-circle" />
                    <span>Email sent successfully! ID: <code className="text-white/50">{emailResult.id}</code></span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-times-circle" />
                    <span>Failed: {emailResult.error}</span>
                  </>
                )}
              </div>
            )}

            <details className="mt-2">
              <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                <i className="fas fa-book mr-1" /> Resend email setup guide
              </summary>
              <div className="mt-2 bg-black/30 rounded-xl p-4 text-xs text-white/50 space-y-2">
                <p><strong className="text-white/70">1.</strong> Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-racing-400 underline">resend.com</a> (free tier: 3,000 emails/month)</p>
                <p><strong className="text-white/70">2.</strong> Create an API key and add it to <code className="text-racing-400">.env.local</code> as <code className="text-racing-400">RESEND_API_KEY=re_...</code></p>
                <p><strong className="text-white/70">3.</strong> Add and verify your domain in Resend (DNS records) for production sending</p>
                <p><strong className="text-white/70">4.</strong> Set <code className="text-racing-400">EMAIL_FROM=&quot;AutoHue &lt;noreply@yourdomain.com&gt;&quot;</code> in <code className="text-racing-400">.env.local</code></p>
                <p><strong className="text-white/70">5.</strong> In dev, you can send to your own email without domain verification</p>
              </div>
            </details>
          </div>
        </div>

        {/* ═══ QUICK REFERENCE ═══ */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2 mb-4">
            <i className="fas fa-info-circle text-racing-500" />
            Recurring Billing Reference
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/30 text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Price</th>
                  <th className="pb-3 pr-4">Credits</th>
                  <th className="pb-3 pr-4">Retention</th>
                  <th className="pb-3 pr-4">Billing</th>
                  <th className="pb-3">Stripe Events</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-t border-white/5">
                  <td className="py-3 pr-4 font-bold">Free</td>
                  <td className="py-3 pr-4">$0</td>
                  <td className="py-3 pr-4">10/mo</td>
                  <td className="py-3 pr-4">24 hours</td>
                  <td className="py-3 pr-4 text-white/30">—</td>
                  <td className="py-3 text-white/30">—</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-3 pr-4 font-bold">Starter</td>
                  <td className="py-3 pr-4">$29/mo</td>
                  <td className="py-3 pr-4">500/mo</td>
                  <td className="py-3 pr-4">7 days</td>
                  <td className="py-3 pr-4">Monthly recurring</td>
                  <td className="py-3 font-mono text-[10px] text-white/40">checkout → sub.updated → sub.deleted</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-3 pr-4 font-bold text-racing-400">Pro</td>
                  <td className="py-3 pr-4">$79/mo</td>
                  <td className="py-3 pr-4">5,000/mo</td>
                  <td className="py-3 pr-4">30 days</td>
                  <td className="py-3 pr-4">Monthly recurring</td>
                  <td className="py-3 font-mono text-[10px] text-white/40">checkout → sub.updated → sub.deleted</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="py-3 pr-4 font-bold">Enterprise</td>
                  <td className="py-3 pr-4">$199/mo</td>
                  <td className="py-3 pr-4">Unlimited</td>
                  <td className="py-3 pr-4">90 days</td>
                  <td className="py-3 pr-4">Monthly recurring</td>
                  <td className="py-3 font-mono text-[10px] text-white/40">checkout → sub.updated → sub.deleted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
