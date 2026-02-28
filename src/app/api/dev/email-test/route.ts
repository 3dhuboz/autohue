import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { sendTestEmail, sendWelcomeEmail, sendSubscriptionEmail, sendSortCompleteEmail, sendPaymentFailedEmail } from '@/lib/email';

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  try {
    const { type, to } = await req.json() as { type: string; to: string };

    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
    }

    let result;
    const name = session.user.name || 'Test User';

    switch (type) {
      case 'test':
        result = await sendTestEmail(to);
        break;
      case 'welcome':
        result = await sendWelcomeEmail(to, name);
        break;
      case 'subscription':
        result = await sendSubscriptionEmail(to, name, 'Pro', 79, new Date(Date.now() + 30 * 86400000));
        break;
      case 'sort-complete':
        result = await sendSortCompleteEmail(to, name, 150, 8, 'demo-session-id');
        break;
      case 'payment-failed':
        result = await sendPaymentFailedEmail(to, name, 'Pro');
        break;
      default:
        return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
