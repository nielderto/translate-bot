import { describe, it, expect, vi } from 'vitest';
import { activeIndexAt, makePlayerSync, type TimedLine } from '../src/content/playerSync';

const lines: TimedLine[] = [
  { index: 0, startTime: 0, endTime: 2 },
  { index: 1, startTime: 2.5, endTime: 4 },
  { index: 2, startTime: 4, endTime: 6 },
];

describe('activeIndexAt', () => {
  it('returns the line whose interval contains t', () => {
    expect(activeIndexAt(lines, 1.0)).toBe(0);
    expect(activeIndexAt(lines, 3.0)).toBe(1);
    expect(activeIndexAt(lines, 5.0)).toBe(2);
  });
  it('returns -1 between lines', () => {
    expect(activeIndexAt(lines, 2.1)).toBe(-1);
  });
  it('returns -1 before first / after last', () => {
    expect(activeIndexAt(lines, -1)).toBe(-1);
    expect(activeIndexAt(lines, 99)).toBe(-1);
  });
});

describe('makePlayerSync', () => {
  it('fires onChange only when the active index changes', () => {
    let t = 0;
    const onChange = vi.fn();
    const sync = makePlayerSync({ getTime: () => t, lines, onChange });
    sync.tick();
    sync.tick();
    t = 3;
    sync.tick();
    t = 2.1;
    sync.tick();
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([0, 1, -1]);
  });
});
