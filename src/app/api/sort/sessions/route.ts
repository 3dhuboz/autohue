import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const sessions = await prisma.sortSession.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      workerSession: true,
      totalImages: true,
      status: true,
      colorCounts: true,
      creditsUsed: true,
      expiresAt: true,
      deletedAt: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ sessions });
}
