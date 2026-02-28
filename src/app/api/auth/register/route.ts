import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { syncPlanCredits } from '@/lib/credits';
import { rateLimit, AUTH_LIMIT, getRateLimitKey } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const rl = rateLimit(getRateLimitKey(req, 'register'), AUTH_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        hashedPassword,
        subscription: {
          create: { plan: 'FREE', status: 'ACTIVE' },
        },
      },
    });

    // Initialize credits for the free plan
    await syncPlanCredits(user.id, 'FREE');

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
