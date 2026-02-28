import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCredits } from '@/lib/credits';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const credits = await getCredits(userId);

  return NextResponse.json({
    monthlyLimit: credits.monthlyLimit,
    used: credits.used,
    extraCredits: credits.extraCredits,
    remaining: credits.remaining === Infinity ? -1 : credits.remaining,
    isUnlimited: credits.isUnlimited,
    periodResetDate: credits.periodResetDate,
  });
}
