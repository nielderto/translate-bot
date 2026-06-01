import type { Request, Response, NextFunction } from 'express';

export interface Limiter {
  check(ip: string): boolean;
  middleware(): (req: Request, res: Response, next: NextFunction) => void;
}

export function makeLimiter({ maxPerHour }: { maxPerHour: number }): Limiter {
  const buckets = new Map<string, number[]>();
  const windowMs = 60 * 60 * 1000;

  const limiter: Limiter = {
    check(ip: string): boolean {
      const now = Date.now();
      const arr = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs);
      if (arr.length >= maxPerHour) {
        buckets.set(ip, arr);
        return false;
      }
      arr.push(now);
      buckets.set(ip, arr);
      return true;
    },
    middleware() {
      return (req: Request, res: Response, next: NextFunction): void => {
        const ip = req.ip ?? 'unknown';
        if (!limiter.check(ip)) {
          res.status(429).json({ error: 'rate limit exceeded' });
          return;
        }
        next();
      };
    },
  };

  return limiter;
}
