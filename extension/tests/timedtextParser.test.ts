import { describe, it, expect } from 'vitest';
import { parseTimedtextJson3 } from '../src/content/captureTimedtext';

const sample = {
  events: [
    { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: '你好' }] },
    { tStartMs: 2500, dDurationMs: 1500, segs: [{ utf8: '世' }, { utf8: '界' }] },
    { tStartMs: 4000, dDurationMs: 1000, segs: [{ utf8: '\n' }] },
  ],
};

describe('parseTimedtextJson3', () => {
  it('produces lines with index/text/startTime/endTime in seconds', () => {
    const lines = parseTimedtextJson3(sample);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ index: 0, text: '你好', startTime: 0, endTime: 2 });
    expect(lines[1]).toEqual({ index: 1, text: '世界', startTime: 2.5, endTime: 4 });
  });

  it('returns empty for empty events', () => {
    expect(parseTimedtextJson3({ events: [] })).toEqual([]);
    expect(parseTimedtextJson3({})).toEqual([]);
  });
});
