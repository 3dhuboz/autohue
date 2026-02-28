import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getCredits } from '@/lib/credits';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [credits, subscription, sortSessions] = await Promise.all([
    getCredits(userId),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.sortSession.findMany({
      where: { userId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const totalImages = sortSessions.reduce((sum: number, s: { totalImages: number }) => sum + s.totalImages, 0);
  const totalSessions = sortSessions.length;

  return NextResponse.json({
    plan: subscription?.plan || 'FREE',
    credits: {
      monthlyLimit: credits.monthlyLimit,
      used: credits.used,
      extraCredits: credits.extraCredits,
      remaining: credits.remaining === Infinity ? -1 : credits.remaining,
      isUnlimited: credits.isUnlimited,
    },
    stats: {
      totalImages,
      totalSessions,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentSessions: sortSessions.map((s: any) => ({
      id: s.id,
      workerSession: s.workerSession,
      totalImages: s.totalImages,
      status: s.status,
      colorCounts: s.colorCounts,
      creditsUsed: s.creditsUsed,
      expiresAt: s.expiresAt ?? null,
      createdAt: s.createdAt,
      completedAt: s.completedAt,
    })),
  });
}
