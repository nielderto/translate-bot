import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateLines, putTranscript } from '../src/lib/api';

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

describe('translateLines', () => {
  it('POSTs to /translate and returns lines', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        lines: [{ index: 0, original: '你好', translation: 'Hello', romanization: 'nǐ hǎo' }],
      }),
    });
    const out = await translateLines('http://b', {
      videoId: 'v1',
      sourceLang: 'zh',
      targetLang: 'en',
      lines: [{ index: 0, text: '你好' }],
    });
    expect(out).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://b/translate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-OK response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'err',
    });
    await expect(
      translateLines('http://b', { videoId: 'v1', sourceLang: 'zh', targetLang: 'en', lines: [] }),
    ).rejects.toThrow();
  });
});

describe('putTranscript', () => {
  it('POSTs transcript', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    await putTranscript('http://b', 'v1', 'zh', [{ index: 0, text: 'x' }]);
    expect(fetch).toHaveBeenCalledWith(
      'http://b/transcript/v1',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
