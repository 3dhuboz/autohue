import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { addExtraCredits } from '@/lib/credits';
import { rateLimit, API_LIMIT, getRateLimitKey } from '@/lib/rate-limit';

const CREDIT_PACKS = [
  { id: 'pack-100', credits: 100, price: 9 },
  { id: 'pack-500', credits: 500, price: 39 },
  { id: 'pack-1000', credits: 1000, price: 69 },
] as const;

export async function GET() {
  return NextResponse.json({ packs: CREDIT_PACKS });
}

export async function POST(req: Request) {
  const rl = rateLimit(getRateLimitKey(req, 'credits-buy'), API_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { packId } = await req.json();
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: 'Invalid credit pack' }, { status: 400 });
    }

    // In production, this would create a Stripe payment intent first
    // For now, directly add credits (integrate Stripe one-time payment later)
    await addExtraCredits(session.user.id, pack.credits);

    return NextResponse.json({
      success: true,
      creditsAdded: pack.credits,
      message: `Added ${pack.credits} extra credits to your account`,
    });
  } catch (error) {
    console.error('Buy credits error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}
