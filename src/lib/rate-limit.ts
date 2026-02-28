const rateMap = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export function rateLimit(key: string, config: RateLimitConfig): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateMap.set(key, { count: 1, resetTime: now + config.windowMs });
    return { success: true, remaining: config.max - 1 };
  }

  if (entry.count >= config.max) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: config.max - entry.count };
}

// Presets
export const AUTH_LIMIT: RateLimitConfig = { windowMs: 15 * 60 * 1000, max: 10 }; // 10 attempts / 15 min
export const API_LIMIT: RateLimitConfig = { windowMs: 60 * 1000, max: 60 };       // 60 req / min
export const WEBHOOK_LIMIT: RateLimitConfig = { windowMs: 60 * 1000, max: 200 };  // 200 / min

export function getRateLimitKey(req: Request, prefix: string): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `${prefix}:${ip}`;
}
