import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, setSettings, DEFAULT_SETTINGS } from '../src/lib/storage';

beforeEach(() => {
  const data: Record<string, unknown> = {};
  const mock = {
    storage: {
      sync: {
        get: vi.fn((_keys: string[], cb: (d: Record<string, unknown>) => void) => cb(data)),
        set: vi.fn((obj: Record<string, unknown>, cb?: () => void) => {
          Object.assign(data, obj);
          cb?.();
        }),
      },
    },
  };
  (globalThis as { chrome?: unknown }).chrome = mock;
});

describe('storage', () => {
  it('returns defaults when nothing stored', async () => {
    const s = await getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings', async () => {
    await setSettings({ sourceLang: 'ko', enabled: false });
    const s = await getSettings();
    expect(s.sourceLang).toBe('ko');
    expect(s.enabled).toBe(false);
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });
});
