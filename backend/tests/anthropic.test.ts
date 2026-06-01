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
      content: [{ type: 'text', text: '["0","Hello","nǐ hǎo"]]' }],
    });
    const out = await translateBatch([{ index: 0, text: '你好' }], 'zh');
    expect(out).toEqual([{ index: 0, translation: 'Hello', romanization: 'nǐ hǎo' }]);
  });

  it('throws when claude returns non-JSON', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    await expect(translateBatch([{ index: 0, text: '你好' }], 'zh')).rejects.toThrow();
  });

  it('parses multiple lines in order', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '["0","Hello","nǐ hǎo"],["1","Goodbye","zàijiàn"]]' }],
    });
    const out = await translateBatch(
      [{ index: 0, text: '你好' }, { index: 1, text: '再见' }],
      'zh',
    );
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ index: 1, translation: 'Goodbye', romanization: 'zàijiàn' });
  });
});

describe('streamTranslateBatch', () => {
  it('yields TranslatedLine objects as they arrive in chunked stream', async () => {
    // API does not echo the prefill '['; stream starts directly with inner items.
    // Claude returns indices as strings ("0" not 0) — Number() coerces them back.
    const chunks = [
      '["0","Hel',
      'lo","ann',
      'yeonghaseyo"],["1","Goodbye","an',
      'nyeonghaseyo"]]',
    ];

    async function* fakeStream() {
      for (const text of chunks) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
    }

    stream.mockReturnValue({ [Symbol.asyncIterator]: fakeStream });

    const results: { index: number; translation: string; romanization: string }[] = [];
    for await (const line of streamTranslateBatch([
      { index: 0, text: '안녕하세요' },
      { index: 1, text: '잘 가' },
    ], 'ko')) {
      results.push(line);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ index: 0, translation: 'Hello', romanization: 'annyeonghaseyo' });
    expect(results[1]).toEqual({ index: 1, translation: 'Goodbye', romanization: 'annyeonghaseyo' });
  });
});
