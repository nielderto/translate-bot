import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { getDb, getPool } from '../src/db';
import { transcripts } from '../src/schema';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

async function* fakeStream(): AsyncGenerator<string> {
  yield 'Hello, ';
  yield 'world.';
}

const streamChat = vi.fn();
vi.mock('../src/anthropic', () => ({
  streamChat,
  translateBatch: vi.fn(),
}));

const { createApp } = await import('../src/index');

beforeEach(async () => {
  await getDb().delete(transcripts);
  streamChat.mockReset();
});
afterAll(async () => {
  await getPool().end();
});

describe('POST /chat', () => {
  it('streams SSE chunks from claude', async () => {
    await getDb().insert(transcripts).values({
      videoId: 'v1',
      sourceLang: 'zh',
      linesJson: [{ index: 0, text: '你好', translation: 'Hello' }],
    });
    streamChat.mockReturnValue(fakeStream());

    const res = await request(createApp())
      .post('/chat')
      .send({
        videoId: 'v1',
        sourceLang: 'zh',
        clickedLineIndex: 0,
        question: 'meaning?',
        history: [],
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.text).toContain('data: Hello, ');
    expect(res.text).toContain('data: world.');
    expect(res.text).toContain('data: [DONE]');
  });

  it('returns 404 when transcript missing', async () => {
    const res = await request(createApp())
      .post('/chat')
      .send({
        videoId: 'missing',
        sourceLang: 'zh',
        clickedLineIndex: 0,
        question: 'q',
        history: [],
      });
    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid body', async () => {
    const res = await request(createApp())
      .post('/chat')
      .send({ videoId: 'v1' });
    expect(res.status).toBe(400);
  });
});
