import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const sessionId = params.id;

  // Verify ownership
  const sortSession = await prisma.sortSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!sortSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Mark as deleted (soft delete) and request worker file cleanup
  await prisma.sortSession.update({
    where: { id: sessionId },
    data: { status: 'deleted', deletedAt: new Date() },
  });

  // Request worker to delete files (best-effort)
  const workerUrl = process.env.WORKER_URL || 'http://localhost:3001';
  try {
    await fetch(`${workerUrl}/cleanup/${sortSession.workerSession}`, { method: 'DELETE' });
  } catch {
    // Worker cleanup is best-effort
  }

  return NextResponse.json({ success: true });
}
