import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn();
const stream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
    beta = {
      promptCaching: {
        messages: { stream, create },
      },
    };
  },
}));

const { translateBatch, streamTranslateBatch } = await import('../src/anthropic');

beforeEach(() => { create.mockReset(); stream.mockReset(); });

describe('translateBatch', () => {
  it('parses compact array format returned by claude', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '["0","Hello"]]' }],
    });
    const out = await translateBatch([{ index: 0, text: '你好' }], 'zh');
    expect(out).toEqual([{ index: 0, translation: 'Hello' }]);
  });

  it('throws when claude returns non-JSON', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    await expect(translateBatch([{ index: 0, text: '你好' }], 'zh')).rejects.toThrow();
  });

  it('parses multiple lines in order', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '["0","Hello"],["1","Goodbye"]]' }],
    });
    const out = await translateBatch(
      [{ index: 0, text: '你好' }, { index: 1, text: '再见' }],
      'zh',
    );
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ index: 1, translation: 'Goodbye' });
  });
});

describe('streamTranslateBatch', () => {
  it('yields TranslatedLine objects as they arrive in chunked stream', async () => {
    // API does not echo the prefill '['; stream starts directly with inner items.
    // Claude returns indices as strings ("0" not 0) — Number() coerces them back.
    const chunks = [
      '["0","Hel',
      'lo"],["1","Goodby',
      'e"]]',
    ];

    async function* fakeStream() {
      for (const text of chunks) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
    }

    stream.mockReturnValue({ [Symbol.asyncIterator]: fakeStream });

    const results: { index: number; translation: string }[] = [];
    for await (const line of streamTranslateBatch([
      { index: 0, text: '안녕하세요' },
      { index: 1, text: '잘 가' },
    ], 'ko')) {
      results.push(line);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ index: 0, translation: 'Hello' });
    expect(results[1]).toEqual({ index: 1, translation: 'Goodbye' });
  });

  it('correctly parses all items from a large batch streamed in single chunk', async () => {
    const N = 50;
    const items = Array.from({ length: N }, (_, i) => [`"${i}"`, `"T${i}"`].join(','));
    const payload = items.map((item) => `[${item}]`).join(',') + ']';

    async function* fakeStream() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: payload } };
    }

    stream.mockReturnValue({ [Symbol.asyncIterator]: fakeStream });

    const inputLines = Array.from({ length: N }, (_, i) => ({ index: i, text: `text${i}` }));
    const results: { index: number; translation: string }[] = [];
    for await (const line of streamTranslateBatch(inputLines, 'zh')) {
      results.push(line);
    }

    expect(results).toHaveLength(N);
    expect(results[0]).toEqual({ index: 0, translation: 'T0' });
    expect(results[N - 1]).toEqual({ index: N - 1, translation: `T${N - 1}` });
  });
});
