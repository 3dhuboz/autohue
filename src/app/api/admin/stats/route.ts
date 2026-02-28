import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [
    totalUsers,
    activeSubs,
    totalSortSessions,
    totalImagesSorted,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' } } }),
    prisma.sortSession.count(),
    prisma.sortSession.aggregate({ _sum: { totalImages: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
  ]);

  // Revenue estimate (based on active subscriptions)
  const planCounts = await prisma.subscription.groupBy({
    by: ['plan'],
    where: { status: 'ACTIVE', plan: { not: 'FREE' } },
    _count: true,
  });

  const planPrices: Record<string, number> = { STARTER: 29, PRO: 79, ENTERPRISE: 199 };
  const monthlyRevenue = planCounts.reduce((sum: number, p: { plan: string; _count: number }) => sum + (planPrices[p.plan] || 0) * p._count, 0);

  return NextResponse.json({
    totalUsers,
    activeSubs,
    totalSortSessions,
    totalImagesSorted: totalImagesSorted._sum.totalImages || 0,
    monthlyRevenue,
    recentUsers,
    planBreakdown: planCounts,
  });
}
