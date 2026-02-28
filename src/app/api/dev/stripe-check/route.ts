import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { stripe, PLANS } from '@/lib/stripe';

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  const checks: Record<string, { status: 'ok' | 'warning' | 'error'; detail: string }> = {};

  // 1. Check Stripe API key
  try {
    const account = await stripe.accounts.retrieve();
    checks['stripe_api_key'] = {
      status: 'ok',
      detail: `Connected to Stripe account: ${account.id} (${account.settings?.dashboard?.display_name || 'unnamed'})`,
    };
  } catch (err) {
    checks['stripe_api_key'] = {
      status: 'error',
      detail: `Stripe API key invalid: ${(err as Error).message}`,
    };
  }

  // 2. Check webhook secret is set
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    checks['webhook_secret'] = {
      status: 'ok',
      detail: `Webhook secret configured (${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10)}...)`,
    };
  } else {
    checks['webhook_secret'] = {
      status: 'error',
      detail: 'STRIPE_WEBHOOK_SECRET not set in environment',
    };
  }

  // 3. Check price IDs exist in Stripe
  for (const [planKey, plan] of Object.entries(PLANS)) {
    if (planKey === 'FREE' || !plan.stripePriceId) {
      checks[`price_${planKey.toLowerCase()}`] = {
        status: planKey === 'FREE' ? 'ok' : 'warning',
        detail: planKey === 'FREE' ? 'Free plan — no price ID needed' : `STRIPE_${planKey}_PRICE_ID not set in environment`,
      };
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(plan.stripePriceId);
      const recurring = price.recurring;
      checks[`price_${planKey.toLowerCase()}`] = {
        status: 'ok',
        detail: `${planKey}: $${(price.unit_amount || 0) / 100}/${recurring?.interval || 'one-time'} (${price.id}) — ${price.active ? 'active' : 'INACTIVE'}`,
      };
    } catch {
      checks[`price_${planKey.toLowerCase()}`] = {
        status: 'error',
        detail: `${planKey}: Price ID "${plan.stripePriceId}" not found in Stripe`,
      };
    }
  }

  // 4. Check Stripe mode (test vs live)
  const isTestMode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
  checks['stripe_mode'] = {
    status: isTestMode ? 'ok' : 'warning',
    detail: isTestMode ? 'Running in TEST mode (safe for development)' : 'Running in LIVE mode — real charges will occur!',
  };

  // 5. Check Resend email config
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder') {
    checks['email_resend'] = {
      status: 'ok',
      detail: `Resend API key configured (${process.env.RESEND_API_KEY.substring(0, 8)}...)`,
    };
  } else {
    checks['email_resend'] = {
      status: 'warning',
      detail: 'RESEND_API_KEY not set — emails will not send',
    };
  }

  // Overall status
  const hasErrors = Object.values(checks).some(c => c.status === 'error');
  const hasWarnings = Object.values(checks).some(c => c.status === 'warning');

  return NextResponse.json({
    overall: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok',
    checks,
    env_summary: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? `${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...` : 'NOT SET',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'SET' : 'NOT SET',
      STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID || 'NOT SET',
      STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID || 'NOT SET',
      STRIPE_ENTERPRISE_PRICE_ID: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'NOT SET',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
      EMAIL_FROM: process.env.EMAIL_FROM || 'DEFAULT (noreply@autohue.com)',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    },
  });
}
