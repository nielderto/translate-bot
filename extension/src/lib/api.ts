export interface InputLine {
  index: number;
  text: string;
  startTime?: number;
  endTime?: number;
}

export interface OutputLine {
  index: number;
  original: string;
  translation: string;
  romanization: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TranslateRequest {
  videoId: string;
  sourceLang: 'zh' | 'ko';
  targetLang: 'en';
  lines: InputLine[];
  hasCaptions?: boolean;
}

export interface ChatRequest {
  videoId: string;
  sourceLang: 'zh' | 'ko';
  clickedLineIndex: number;
  question: string;
  history: ChatHistoryMessage[];
  /** Fallback line context sent inline so chat works even if DB transcript is missing */
  lineText?: string;
  lineTranslation?: string;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url} → ${r.status}: ${await r.text()}`);
  return r;
}

export async function translateLines(
  backendUrl: string,
  req: TranslateRequest,
): Promise<OutputLine[]> {
  const r = await postJson(`${backendUrl}/translate`, req);
  const data = (await r.json()) as { lines: OutputLine[] };
  return data.lines;
}

export async function* streamTranslateLines(
  backendUrl: string,
  req: TranslateRequest,
  signal?: AbortSignal,
): AsyncGenerator<OutputLine> {
  const r = await fetch(`${backendUrl}/translate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok || !r.body) return;
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const evt of events) {
      const line = evt.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try { yield JSON.parse(data) as OutputLine; } catch {}
    }
  }
}

export async function fetchAllCached(
  backendUrl: string,
  videoId: string,
  sourceLang: 'zh' | 'ko',
): Promise<OutputLine[]> {
  const r = await fetch(
    `${backendUrl}/translations/${encodeURIComponent(videoId)}?sourceLang=${sourceLang}&targetLang=en`,
  );
  if (!r.ok) return [];
  const data = (await r.json()) as { lines: OutputLine[] };
  return data.lines ?? [];
}

export async function putTranscript(
  backendUrl: string,
  videoId: string,
  sourceLang: 'zh' | 'ko',
  lines: InputLine[],
): Promise<void> {
  await postJson(`${backendUrl}/transcript/${encodeURIComponent(videoId)}`, {
    sourceLang,
    lines,
  });
}

export async function getTranscript(
  backendUrl: string,
  videoId: string,
  sourceLang: 'zh' | 'ko',
): Promise<InputLine[] | null> {
  const r = await fetch(
    `${backendUrl}/transcript/${encodeURIComponent(videoId)}?sourceLang=${sourceLang}`,
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getTranscript: ${r.status}`);
  const data = (await r.json()) as { lines: InputLine[] };
  return data.lines;
}

export async function* streamChat(
  backendUrl: string,
  req: ChatRequest,
): AsyncGenerator<string, void, unknown> {
  const r = await fetch(`${backendUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`chat: ${r.status}`);
  if (!r.body) throw new Error('chat: no body');
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const evt of events) {
      const line = evt.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      yield data;
    }
  }
}
