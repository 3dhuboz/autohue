import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { deductCredits } from '@/lib/credits';
import prisma from '@/lib/prisma';

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

  // Record session
  const sortSession = await prisma.sortSession.create({
    data: {
      userId,
      workerSession: workerSession || 'unknown',
      totalImages,
      status: 'completed',
      colorCounts: colorCounts || {},
      creditsUsed: totalImages,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ sessionId: sortSession.id, creditsUsed: totalImages });
}
