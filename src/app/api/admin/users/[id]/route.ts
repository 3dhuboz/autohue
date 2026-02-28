import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { syncPlanCredits } from '@/lib/credits';
import prisma from '@/lib/prisma';
import type { PlanKey } from '@/lib/stripe';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { plan, role } = await req.json();

  if (role) {
    await prisma.user.update({
      where: { id: params.id },
      data: { role },
    });
  }

  if (plan) {
    await prisma.subscription.upsert({
      where: { userId: params.id },
      update: { plan, status: 'ACTIVE' },
      create: { userId: params.id, plan, status: 'ACTIVE' },
    });
    await syncPlanCredits(params.id, plan as PlanKey);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
