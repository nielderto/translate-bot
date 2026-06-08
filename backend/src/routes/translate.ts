import { Router, type Request, type Response } from 'express';
import { translateBatch, streamTranslateBatch } from '../anthropic';
import type { SourceLang } from '../anthropic';
import { getCachedLines, getAllCachedLines, putCachedLines, type CachedLine } from '../lib/cache';
import { romanizeZh, romanizeKo } from '../lib/romanize';

const SUPPORTED_SOURCE = new Set<SourceLang>(['zh', 'ko']);
const SUPPORTED_TARGET = new Set<string>(['en']);

interface TranslateRequestLine {
  index: number;
  text: string;
  startTime?: number;
  endTime?: number;
}

interface TranslateRequestBody {
  videoId?: string;
  sourceLang?: string;
  targetLang?: string;
  lines?: TranslateRequestLine[];
  hasCaptions?: boolean;
}

function isValidBody(
  body: TranslateRequestBody,
): body is Required<Pick<TranslateRequestBody, 'videoId' | 'sourceLang' | 'targetLang' | 'lines'>> {
  return (
    typeof body.videoId === 'string' &&
    typeof body.sourceLang === 'string' &&
    SUPPORTED_SOURCE.has(body.sourceLang as SourceLang) &&
    typeof body.targetLang === 'string' &&
    SUPPORTED_TARGET.has(body.targetLang) &&
    Array.isArray(body.lines)
  );
}

function localRomanize(text: string, sourceLang: string): string {
  if (sourceLang === 'zh') return romanizeZh(text);
  if (sourceLang === 'ko') return romanizeKo(text);
  return '';
}

export function translateRouter(): Router {
  const r = Router();

  r.get('/translations/:videoId', async (req: Request, res: Response) => {
    const videoId = String(req.params['videoId'] ?? '');
    const sourceLang = String(req.query['sourceLang'] ?? '');
    const targetLang = String(req.query['targetLang'] ?? 'en');
    if (!videoId || !SUPPORTED_SOURCE.has(sourceLang as SourceLang)) {
      res.status(400).json({ error: 'invalid request' });
      return;
    }
    const lines = await getAllCachedLines(videoId, sourceLang, targetLang);
    res.json({ lines });
  });

  r.post('/translate/stream', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as TranslateRequestBody;
    const hasCaptions = body.hasCaptions === true;
    if (!isValidBody(body)) { res.status(400).json({ error: 'invalid request' }); return; }
    const { videoId, sourceLang, targetLang, lines } = body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Serve cached lines immediately
    const indices = lines.map((l) => l.index);
    const cached = await getCachedLines(videoId, sourceLang, targetLang, indices);
    const lineTextByIndex = new Map(lines.map((l) => [l.index, l.text]));
    const validCached = cached.filter(
      (c) =>
        !!c.romanization &&
        c.original === lineTextByIndex.get(c.index) &&
        (!!c.translation || hasCaptions),
    );
    const cachedIdx = new Set(validCached.map((c) => c.index));
    for (const c of validCached) send(c);

    const missing = lines.filter((l) => !cachedIdx.has(l.index));

    if (missing.length > 0) {
      // When English captions are already shown, skip Claude entirely — compute romanization locally.
      if (hasCaptions) {
        const toCache: CachedLine[] = missing.map((l) => ({
          index: l.index,
          original: l.text,
          translation: '',
          romanization: localRomanize(l.text, sourceLang),
        }));
        for (const result of toCache) {
          if (result.romanization) send(result);
        }
        putCachedLines(videoId, sourceLang, targetLang, toCache.filter((r) => !!r.romanization)).catch(() => {});
      } else {
        try {
          const toCache: CachedLine[] = [];
          for await (const t of streamTranslateBatch(missing, sourceLang as SourceLang)) {
            const result: CachedLine = {
              index: t.index,
              original: lineTextByIndex.get(t.index) ?? '',
              translation: t.translation,
              romanization: localRomanize(lineTextByIndex.get(t.index) ?? '', sourceLang),
            };
            send(result);
            if (result.romanization) toCache.push(result);
          }
          putCachedLines(videoId, sourceLang, targetLang, toCache).catch(() => {});
        } catch (err) {
          console.error('[translate/stream]', err);
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  });

  r.post('/translate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as TranslateRequestBody;
    const hasCaptions = body.hasCaptions === true;
    if (!isValidBody(body)) {
      res.status(400).json({ error: 'invalid request' });
      return;
    }

    const { videoId, sourceLang, targetLang, lines } = body;
    const indices = lines.map((l) => l.index);
    const cached = await getCachedLines(videoId, sourceLang, targetLang, indices);
    const lineTextByIndex = new Map(lines.map((l) => [l.index, l.text]));
    const validCached = cached.filter(
      (c) =>
        !!c.romanization &&
        c.original === lineTextByIndex.get(c.index) &&
        (!!c.translation || hasCaptions),
    );
    const cachedIdx = new Set(validCached.map((c) => c.index));
    const missing = lines.filter((l) => !cachedIdx.has(l.index));

    let translated: CachedLine[] = [];
    if (missing.length > 0) {
      if (hasCaptions) {
        translated = missing.map((l) => ({
          index: l.index,
          original: l.text,
          translation: '',
          romanization: localRomanize(l.text, sourceLang),
        }));
        const toCache = translated.filter((t) => !!t.romanization);
        await putCachedLines(videoId, sourceLang, targetLang, toCache);
      } else {
        try {
          const result = await translateBatch(
            missing.map((l) => ({ index: l.index, text: l.text })),
            sourceLang as SourceLang,
          );
          translated = missing.map((l) => {
            const t = result.find((r) => r.index === l.index);
            return {
              index: l.index,
              original: l.text,
              translation: t?.translation ?? '',
              romanization: localRomanize(l.text, sourceLang),
            };
          });
          const toCache = translated.filter((t) => !!t.romanization);
          await putCachedLines(videoId, sourceLang, targetLang, toCache);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'translate failed';
          console.error('[translate] upstream error:', msg);
          res.status(502).json({ error: 'upstream translation failed', detail: msg });
          return;
        }
      }
    }

    const merged = [...validCached, ...translated].sort((a, b) => a.index - b.index);
    res.json({ lines: merged });
  });

  return r;
}
