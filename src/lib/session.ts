import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user) return null;
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!session) return null;
  if (session.user.role !== 'ADMIN') return null;
  return session;
}
