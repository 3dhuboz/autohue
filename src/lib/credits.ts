import prisma from './prisma';
import { getPlanCredits, PlanKey } from './stripe';

export async function getCredits(userId: string) {
  let credit = await prisma.credit.findUnique({ where: { userId } });

  if (!credit) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const plan = (sub?.plan || 'FREE') as PlanKey;
    credit = await prisma.credit.create({
      data: {
        userId,
        monthlyLimit: getPlanCredits(plan),
        used: 0,
        extraCredits: 0,
        periodResetDate: new Date(),
      },
    });
  }

  // Check if period needs reset (monthly)
  const now = new Date();
  const resetDate = new Date(credit.periodResetDate);
  const monthsSince = (now.getFullYear() - resetDate.getFullYear()) * 12 + (now.getMonth() - resetDate.getMonth());

  if (monthsSince >= 1) {
    credit = await prisma.credit.update({
      where: { userId },
      data: {
        used: 0,
        periodResetDate: now,
      },
    });
  }

  const isUnlimited = credit.monthlyLimit === -1;
  const remaining = isUnlimited ? Infinity : Math.max(0, credit.monthlyLimit - credit.used + credit.extraCredits);

  return {
    ...credit,
    remaining,
    isUnlimited,
  };
}

export async function deductCredits(userId: string, count: number): Promise<boolean> {
  const credits = await getCredits(userId);

  if (credits.isUnlimited) return true;
  if (credits.remaining < count) return false;

  // Deduct from extra credits first, then monthly
  let extraUsed = 0;
  let monthlyUsed = count;

  if (credits.extraCredits > 0) {
    extraUsed = Math.min(credits.extraCredits, count);
    monthlyUsed = count - extraUsed;
  }

  await prisma.credit.update({
    where: { userId },
    data: {
      used: { increment: monthlyUsed },
      extraCredits: { decrement: extraUsed },
    },
  });

  return true;
}

export async function addExtraCredits(userId: string, amount: number) {
  return prisma.credit.upsert({
    where: { userId },
    update: { extraCredits: { increment: amount } },
    create: {
      userId,
      monthlyLimit: 0,
      used: 0,
      extraCredits: amount,
      periodResetDate: new Date(),
    },
  });
}

export async function syncPlanCredits(userId: string, plan: PlanKey) {
  const limit = getPlanCredits(plan);
  return prisma.credit.upsert({
    where: { userId },
    update: { monthlyLimit: limit },
    create: {
      userId,
      monthlyLimit: limit,
      used: 0,
      extraCredits: 0,
      periodResetDate: new Date(),
    },
  });
}
