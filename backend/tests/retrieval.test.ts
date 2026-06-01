import { describe, it, expect } from 'vitest';
import { retrieveLines, hasBackwardCue, type TranscriptLine } from '../src/lib/retrieval';

describe('hasBackwardCue', () => {
  it('detects backward-looking words', () => {
    expect(hasBackwardCue('what did she say earlier?')).toBe(true);
    expect(hasBackwardCue('before this scene')).toBe(true);
    expect(hasBackwardCue('what does this word mean?')).toBe(false);
  });
});

describe('retrieveLines', () => {
  const transcript: TranscriptLine[] = [
    { index: 0, text: 'My brother is a doctor.' },
    { index: 1, text: 'I am hungry today.' },
    { index: 2, text: 'She mentioned her brother again.' },
    { index: 3, text: 'The weather is nice.' },
  ];

  it('returns lines matching the query keywords', () => {
    const out = retrieveLines(transcript, 'brother', 2);
    const idxs = out.map((l) => l.index);
    expect(idxs).toContain(0);
    expect(idxs).toContain(2);
  });

  it('respects topN', () => {
    const out = retrieveLines(transcript, 'is', 1);
    expect(out).toHaveLength(1);
  });

  it('returns empty when no terms match', () => {
    const out = retrieveLines(transcript, 'zzzqqq', 5);
    expect(out).toEqual([]);
  });

  it('returns empty for empty query', () => {
    expect(retrieveLines(transcript, '', 5)).toEqual([]);
  });

  it('returns empty for empty transcript', () => {
    expect(retrieveLines([], 'brother', 5)).toEqual([]);
  });
});
