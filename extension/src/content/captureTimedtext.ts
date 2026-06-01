export interface TimedtextSegment {
  utf8?: string;
}

export interface TimedtextEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: TimedtextSegment[];
}

export interface TimedtextJson3 {
  events?: TimedtextEvent[];
}

export interface SubtitleLine {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
}

export function parseTimedtextJson3(json: TimedtextJson3): SubtitleLine[] {
  const events = json?.events ?? [];
  const lines: SubtitleLine[] = [];
  for (const ev of events) {
    const text = (ev.segs ?? [])
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\n/g, '')
      .trim();
    if (!text) continue;
    const startTime = (ev.tStartMs ?? 0) / 1000;
    const endTime = startTime + (ev.dDurationMs ?? 0) / 1000;
    lines.push({ index: lines.length, text, startTime, endTime });
  }
  return lines;
}

export function findLineAtTime(lines: SubtitleLine[], t: number): SubtitleLine | null {
  for (const l of lines) {
    if (t >= l.startTime && t < l.endTime) return l;
  }
  return null;
}

// Chinese subs appear under 'zh', 'zh-Hans', or 'zh-Hant' depending on the video.
export async function fetchChineseTimedtext(videoId: string): Promise<SubtitleLine[] | null> {
  const [zh, zhHans] = await Promise.all([
    fetchTimedtext(videoId, 'zh'),
    fetchTimedtext(videoId, 'zh-Hans'),
  ]);
  return zh ?? zhHans ?? null;
}

export async function fetchTimedtext(videoId: string, lang: string): Promise<SubtitleLine[] | null> {
  const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}&fmt=json3`;
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok || r.status === 204) return null;
  const text = await r.text();
  if (!text) return null;
  let json: TimedtextJson3;
  try {
    json = JSON.parse(text) as TimedtextJson3;
  } catch {
    return null;
  }
  const lines = parseTimedtextJson3(json);
  return lines.length > 0 ? lines : null;
}
