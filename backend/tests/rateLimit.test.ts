import { describe, it, expect, beforeEach } from 'vitest';
import { makeLimiter, type Limiter } from '../src/lib/rateLimit';

describe('rate limiter', () => {
  let limiter: Limiter;
  beforeEach(() => {
    limiter = makeLimiter({ maxPerHour: 3 });
  });

  it('allows up to max requests', () => {
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
  });

  it('blocks after max exceeded', () => {
    for (let i = 0; i < 3; i++) limiter.check('ip1');
    expect(limiter.check('ip1')).toBe(false);
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < 3; i++) limiter.check('ip1');
    expect(limiter.check('ip2')).toBe(true);
  });
});
