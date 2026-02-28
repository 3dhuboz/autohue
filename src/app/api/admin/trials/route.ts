import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Create a 12-hour trial account
export async function POST(req: Request) {
  const adminSession = await requireAdmin();
  if (!adminSession) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, name, note } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const tempPassword = Math.random().toString(36).slice(-10);
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: name || 'Trial User',
      hashedPassword,
      subscription: {
        create: { plan: 'ENTERPRISE', status: 'TRIALING' },
      },
      credits: {
        create: { monthlyLimit: -1, used: 0, extraCredits: 0, periodResetDate: new Date() },
      },
      trialAccount: {
        create: {
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
          maxImages: -1,
          isActive: true,
          createdBy: adminSession.user.id,
          note: note || null,
        },
      },
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    tempPassword,
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    note,
  }, { status: 201 });
}

// List active trials
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const trials = await prisma.trialAccount.findMany({
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ trials });
}
