import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { deductCredits } from '@/lib/credits';
import prisma from '@/lib/prisma';
import { getExpiresAt, getRetentionLabel } from '@/lib/retention';
import { Plan } from '@prisma/client';

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { workerSession, totalImages, colorCounts } = await req.json();

  // Deduct credits
  const success = await deductCredits(userId, totalImages);
  if (!success) {
    return NextResponse.json({ error: 'Credit deduction failed' }, { status: 403 });
  }

  // Get user plan for retention policy
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const plan = (sub?.plan || 'FREE') as Plan;
  const expiresAt = getExpiresAt(plan);

  // Record session with retention expiry
  const sortSession = await prisma.sortSession.create({
    data: {
      userId,
      workerSession: workerSession || 'unknown',
      totalImages,
      status: 'completed',
      colorCounts: colorCounts || {},
      creditsUsed: totalImages,
      completedAt: new Date(),
      expiresAt,
    },
  });

  return NextResponse.json({
    sessionId: sortSession.id,
    creditsUsed: totalImages,
    expiresAt: expiresAt.toISOString(),
    retentionLabel: getRetentionLabel(plan),
  });
}
