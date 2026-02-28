import prisma from './prisma';

export async function checkTrialExpiry(userId: string): Promise<{ expired: boolean; expiresAt?: Date }> {
  const trial = await prisma.trialAccount.findUnique({ where: { userId } });
  if (!trial || !trial.isActive) return { expired: false };

  if (new Date() > trial.expiresAt) {
    // Deactivate expired trial
    await prisma.trialAccount.update({
      where: { userId },
      data: { isActive: false },
    });
    // Downgrade to free
    await prisma.subscription.update({
      where: { userId },
      data: { plan: 'FREE', status: 'CANCELED' },
    });
    return { expired: true, expiresAt: trial.expiresAt };
  }

  return { expired: false, expiresAt: trial.expiresAt };
}
