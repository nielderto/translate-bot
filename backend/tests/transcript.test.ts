import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { getDb, getPool } from '../src/db';
import { transcripts } from '../src/schema';
import { createApp } from '../src/index';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

beforeEach(async () => {
  await getDb().delete(transcripts);
});
afterAll(async () => {
  await getPool().end();
});

describe('transcript routes', () => {
  it('POST stores, GET retrieves', async () => {
    const lines = [{ index: 0, text: '你好', startTime: 0, endTime: 2 }];
    const put = await request(createApp())
      .post('/transcript/vid1')
      .send({ sourceLang: 'zh', lines });
    expect(put.status).toBe(204);

    const get = await request(createApp()).get('/transcript/vid1?sourceLang=zh');
    expect(get.status).toBe(200);
    expect(get.body.lines).toEqual(lines);
  });

  it('GET returns 404 when missing', async () => {
    const res = await request(createApp()).get('/transcript/nope?sourceLang=zh');
    expect(res.status).toBe(404);
  });

  it('POST upserts (replaces existing transcript)', async () => {
    await request(createApp())
      .post('/transcript/vid1')
      .send({ sourceLang: 'zh', lines: [{ index: 0, text: 'old' }] });
    await request(createApp())
      .post('/transcript/vid1')
      .send({ sourceLang: 'zh', lines: [{ index: 0, text: 'new' }] });
    const get = await request(createApp()).get('/transcript/vid1?sourceLang=zh');
    expect(get.body.lines[0].text).toBe('new');
  });

  it('POST rejects invalid body', async () => {
    const res = await request(createApp())
      .post('/transcript/vid1')
      .send({ sourceLang: 'zh' });
    expect(res.status).toBe(400);
  });
});
