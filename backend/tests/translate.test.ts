import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { getDb, getPool } from '../src/db';
import { translations } from '../src/schema';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const translateBatch = vi.fn();
const streamTranslateBatch = vi.fn();
vi.mock('../src/anthropic', () => ({
  translateBatch,
  streamTranslateBatch,
  streamChat: vi.fn(),
}));

const { createApp } = await import('../src/index');

beforeEach(async () => {
  await getDb().delete(translations);
  translateBatch.mockReset();
});
afterAll(async () => {
  await getPool().end();
});

describe('POST /translate', () => {
  it('calls claude on cache miss, romanizes locally, and caches results', async () => {
    translateBatch.mockResolvedValue([
      { index: 0, translation: 'Hello' },
    ]);
    const res = await request(createApp())
      .post('/translate')
      .send({
        videoId: 'v1',
        sourceLang: 'zh',
        targetLang: 'en',
        lines: [{ index: 0, text: '你好' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.lines[0].translation).toBe('Hello');
    expect(res.body.lines[0].romanization).toBe('nǐ hǎo');
    expect(res.body.lines[0].original).toBe('你好');
    expect(translateBatch).toHaveBeenCalledTimes(1);
  });

  it('serves from cache without calling claude', async () => {
    await getDb().insert(translations).values({
      videoId: 'v1',
      lineIndex: 0,
      sourceLang: 'zh',
      targetLang: 'en',
      original: '你好',
      translation: 'Hello',
      romanization: 'nǐ hǎo',
    });
    const res = await request(createApp())
      .post('/translate')
      .send({
        videoId: 'v1',
        sourceLang: 'zh',
        targetLang: 'en',
        lines: [{ index: 0, text: '你好' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.lines[0].translation).toBe('Hello');
    expect(translateBatch).not.toHaveBeenCalled();
  });

  it('rejects unsupported sourceLang', async () => {
    const res = await request(createApp())
      .post('/translate')
      .send({ videoId: 'v1', sourceLang: 'fr', targetLang: 'en', lines: [] });
    expect(res.status).toBe(400);
  });

  it('merges cached + new lines in index order', async () => {
    await getDb().insert(translations).values({
      videoId: 'v1',
      lineIndex: 1,
      sourceLang: 'zh',
      targetLang: 'en',
      original: 'b',
      translation: 'B',
      romanization: 'b',
    });
    translateBatch.mockResolvedValue([
      { index: 0, translation: 'A' },
      { index: 2, translation: 'C' },
    ]);
    const res = await request(createApp())
      .post('/translate')
      .send({
        videoId: 'v1',
        sourceLang: 'zh',
        targetLang: 'en',
        lines: [
          { index: 0, text: 'a' },
          { index: 1, text: 'b' },
          { index: 2, text: 'c' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.lines.map((l: { index: number }) => l.index)).toEqual([0, 1, 2]);
    expect(translateBatch).toHaveBeenCalledTimes(1);
  });
});

describe('POST /translate with hasCaptions', () => {
  it('skips claude entirely and returns local romanization when hasCaptions=true', async () => {
    const res = await request(createApp())
      .post('/translate')
      .send({
        videoId: 'v1',
        sourceLang: 'zh',
        targetLang: 'en',
        lines: [{ index: 0, text: '你好' }],
        hasCaptions: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.lines[0].romanization).toBe('nǐ hǎo');
    expect(res.body.lines[0].translation).toBe('');
    expect(translateBatch).not.toHaveBeenCalled();
  });
});

describe('POST /translate/stream with hasCaptions', () => {
  it('skips claude entirely and streams local romanization when hasCaptions=true', async () => {
    const res = await request(createApp())
      .post('/translate/stream')
      .send({
        videoId: 'v1',
        sourceLang: 'zh',
        targetLang: 'en',
        lines: [{ index: 0, text: '你好' }],
        hasCaptions: true,
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain('nǐ hǎo');
    expect(streamTranslateBatch).not.toHaveBeenCalled();
  });
});
