import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { name } = await req.json();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: name || null },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(user);
}
