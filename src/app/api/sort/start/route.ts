import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getCredits } from '@/lib/credits';
import { checkTrialExpiry } from '@/lib/trial-check';

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Check trial expiry
  const trial = await checkTrialExpiry(userId);
  if (trial.expired) {
    return NextResponse.json({ error: 'Your trial has expired. Please upgrade to continue.' }, { status: 403 });
  }

  const { imageCount } = await req.json();

  if (!imageCount || imageCount <= 0) {
    return NextResponse.json({ error: 'Invalid image count' }, { status: 400 });
  }

  const credits = await getCredits(userId);
  if (!credits.isUnlimited && credits.remaining < imageCount) {
    return NextResponse.json({
      error: 'Insufficient credits',
      remaining: credits.remaining,
      required: imageCount,
    }, { status: 403 });
  }

  return NextResponse.json({ allowed: true, remaining: credits.remaining });
}
