import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getCredits } from '@/lib/credits';

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const credits = await getCredits(session.user.id);

    return NextResponse.json({
      monthlyLimit: credits.monthlyLimit,
      used: credits.used,
      extraCredits: credits.extraCredits,
      remaining: credits.remaining === Infinity ? -1 : credits.remaining,
      isUnlimited: credits.isUnlimited,
      periodResetDate: credits.periodResetDate,
    });
  } catch (error) {
    console.error('Credits API error:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}
