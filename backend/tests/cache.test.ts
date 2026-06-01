import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, getDb } from '../src/db';
import { translations } from '../src/schema';
import { getCachedLines, putCachedLines } from '../src/lib/cache';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

beforeEach(async () => {
  await getDb().delete(translations);
});
afterAll(async () => {
  await getPool().end();
});

describe('cache', () => {
  it('returns empty for missing lines', async () => {
    const out = await getCachedLines('vid1', 'zh', 'en', [0, 1, 2]);
    expect(out).toEqual([]);
  });

  it('round-trips lines through put + get', async () => {
    await putCachedLines('vid1', 'zh', 'en', [
      { index: 0, original: '你好', translation: 'Hello', romanization: 'nǐ hǎo' },
    ]);
    const out = await getCachedLines('vid1', 'zh', 'en', [0]);
    expect(out).toEqual([
      { index: 0, original: '你好', translation: 'Hello', romanization: 'nǐ hǎo' },
    ]);
  });

  it('returns only requested indices', async () => {
    await putCachedLines('vid1', 'zh', 'en', [
      { index: 0, original: 'a', translation: 'a', romanization: 'a' },
      { index: 1, original: 'b', translation: 'b', romanization: 'b' },
    ]);
    const out = await getCachedLines('vid1', 'zh', 'en', [1]);
    expect(out.map((r) => r.index)).toEqual([1]);
  });

  it('empty indices returns empty without query', async () => {
    const out = await getCachedLines('vid1', 'zh', 'en', []);
    expect(out).toEqual([]);
  });

  it('empty lines put is a no-op', async () => {
    await expect(putCachedLines('vid1', 'zh', 'en', [])).resolves.toBeUndefined();
  });

  it('skips conflicts (does not overwrite existing rows)', async () => {
    await putCachedLines('vid1', 'zh', 'en', [
      { index: 0, original: 'a', translation: 'original-en', romanization: 'a' },
    ]);
    await putCachedLines('vid1', 'zh', 'en', [
      { index: 0, original: 'a', translation: 'overwritten?', romanization: 'a' },
    ]);
    const out = await getCachedLines('vid1', 'zh', 'en', [0]);
    expect(out[0]?.translation).toBe('original-en');
  });
});
