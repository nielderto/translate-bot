export interface TranscriptLine {
  index: number;
  text: string;
}

const BACKWARD_CUES = [
  'earlier',
  'before',
  'previously',
  'previous',
  'past',
  'ago',
  'last time',
  'remember when',
];

export function hasBackwardCue(query: string): boolean {
  const q = query.toLowerCase();
  return BACKWARD_CUES.some((cue) => q.includes(cue));
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function retrieveLines<T extends TranscriptLine>(
  transcript: T[],
  query: string,
  topN = 5,
): T[] {
  const qTerms = tokenize(query);
  if (qTerms.length === 0) return [];

  const docs = transcript.map((line) => ({ line, terms: tokenize(line.text) }));
  const N = docs.length;
  if (N === 0) return [];
  const avgdl = docs.reduce((a, d) => a + d.terms.length, 0) / N;
  const k1 = 1.5;
  const b = 0.75;

  const df = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set(d.terms);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = (t: string): number =>
    Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  const scored = docs.map((d) => {
    const dl = d.terms.length;
    const tfMap = new Map<string, number>();
    for (const t of d.terms) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    let score = 0;
    for (const qt of qTerms) {
      const tf = tfMap.get(qt) ?? 0;
      if (tf === 0) continue;
      score += (idf(qt) * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * dl) / avgdl));
    }
    return { line: d.line, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.line);
}
