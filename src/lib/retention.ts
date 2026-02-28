import { Plan } from '@prisma/client';

// Data retention periods per plan tier (in hours)
export const RETENTION_HOURS: Record<Plan, number> = {
  FREE: 24,           // 24 hours
  STARTER: 168,       // 7 days
  PRO: 720,           // 30 days
  ENTERPRISE: 2160,   // 90 days
};

export const RETENTION_LABELS: Record<Plan, string> = {
  FREE: '24 hours',
  STARTER: '7 days',
  PRO: '30 days',
  ENTERPRISE: '90 days',
};

export function getExpiresAt(plan: Plan): Date {
  const hours = RETENTION_HOURS[plan] || RETENTION_HOURS.FREE;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function getRetentionLabel(plan: Plan): string {
  return RETENTION_LABELS[plan] || RETENTION_LABELS.FREE;
}

export function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

export function timeUntilExpiry(expiresAt: Date | null): string {
  if (!expiresAt) return 'No expiry';
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  if (hours > 0) return `${hours}h remaining`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m remaining`;
}
