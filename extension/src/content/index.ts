import { getSettings, type Settings } from '../lib/storage';
import {
  translateLines,
  streamTranslateLines,
  fetchAllCached,
  putTranscript,
  streamChat,
  type OutputLine,
  type ChatHistoryMessage,
} from '../lib/api';
import { fetchTimedtext, fetchChineseTimedtext, findLineAtTime, type SubtitleLine } from './captureTimedtext';
import { observeCaptions } from './captureDOM';
import { makePlayerSync } from './playerSync';
import { createOverlay } from './overlay';
import { createChatPanel } from './chatPanel';
import { onNavigate, videoIdFromUrl } from './spaWatcher';
import { injectPlayerButton } from './playerButton';

const HIDE_NATIVE_CSS = `
  .ytp-caption-window-container,
  .ytp-caption-window,
  .captions-text,
  .ytp-caption-segment,
  .caption-window,
  .ytp-subtitles-button + .ytp-caption-window-container {
    display: none !important;
  }
`;
const HIDE_STYLE_ID = 'tb-hide-native';

let teardown: (() => void) | null = null;
let history: ChatHistoryMessage[] = [];
let romanMap = new Map<number, OutputLine>();

// Persists across SPA navigations within the same tab so revisiting a video
// requires no network call — translations are already in memory.
const videoTranslations = new Map<string, Map<number, OutputLine>>();

function injectHideNativeCss(): void {
  document.getElementById(HIDE_STYLE_ID)?.remove();
  const s = document.createElement('style');
  s.id = HIDE_STYLE_ID;
  s.textContent = HIDE_NATIVE_CSS;
  document.head.appendChild(s);
}

const BATCH_SIZE = 40;

function parallelRomanize(
  backendUrl: string,
  videoId: string,
  sourceLang: 'zh' | 'ko',
  transcript: SubtitleLine[],
  signal: AbortSignal,
  currentTime: number,
  hasCaptions: boolean,
): void {
  // Sort by distance from current playback position — nearest lines go first
  const sorted = [...transcript].sort(
    (a, b) => Math.abs(a.startTime - currentTime) - Math.abs(b.startTime - currentTime),
  );

  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const slice = sorted.slice(i, i + BATCH_SIZE);
    (async () => {
      if (signal.aborted) return;
      try {
        for await (const o of streamTranslateLines(
          backendUrl,
          {
            videoId,
            sourceLang,
            targetLang: 'en',
            lines: slice.map((l) => ({ index: l.index, text: l.text })),
            hasCaptions,
          },
          signal,
        )) {
          romanMap.set(o.index, o);
        }
      } catch (e) {
        if (signal.aborted) return;
        console.warn('[translate-bot] batch failed', e);
      }
    })();
  }
}

function waitFor<T>(fn: () => T | null, timeoutMs = 10000): Promise<T | null> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = (): void => {
      const v = fn();
      if (v) { resolve(v); return; }
      if (Date.now() - t0 > timeoutMs) { resolve(null); return; }
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function start(): Promise<void> {
  const settings: Settings = await getSettings();
  if (!settings.enabled) return;

  const videoId = videoIdFromUrl(location.href);
  if (!videoId) return;

  // Start timedtext fetches immediately — independent of player readiness.
  const timedtextPromise = Promise.all([
    fetchTimedtext(videoId, 'ko'),
    fetchChineseTimedtext(videoId),
    fetchTimedtext(videoId, 'en'),
  ]);

  const player = await waitFor<HTMLElement>(
    () => document.querySelector<HTMLElement>('.html5-video-player'),
  );
  const video = await waitFor<HTMLVideoElement>(
    () => document.querySelector<HTMLVideoElement>('video.html5-main-video'),
  );
  if (!player || !video) return;

  const overlay = createOverlay();
  overlay.mount(player);
  overlay.setFontSize(settings.fontSize);

  let removeBtn: (() => void) | null = null;
  waitFor(() => document.querySelector('.ytp-time-display'), 5000).then((el) => {
    if (el) removeBtn = injectPlayerButton(() => {});
  });

  const chat = createChatPanel();
  let chatOpen = false;
  let clickedLineIndex = -1;
  let clickedLineText = '';
  let clickedLineTranslation = '';
  // Set after language detection below; closure captures by reference so it sees the final value.
  let detectedLang: 'ko' | 'zh' = settings.sourceLang;

  overlay.onAskClick(() => {
    if (chatOpen) return;
    if (clickedLineIndex < 0) return;
    video.pause();
    chatOpen = true;
    const root = overlay.shadowRoot();
    if (!root) return;
    chat.attach(root, {
      onSend: async (question: string) => {
        chat.appendHistory({ role: 'user', content: question });
        history.push({ role: 'user', content: question });
        try {
          const stream = streamChat(settings.backendUrl, {
            videoId,
            sourceLang: detectedLang,
            clickedLineIndex,
            question,
            history,
            lineText: clickedLineText,
            lineTranslation: clickedLineTranslation,
          });
          let full = '';
          await chat.streamAssistant(
            (async function* () {
              for await (const c of stream) { full += c; yield c; }
            })(),
          );
          history.push({ role: 'assistant', content: full });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'error';
          chat.appendHistory({ role: 'assistant', content: `[error: ${msg}]` });
        }
      },
      onClose: () => {
        chat.detach();
        chatOpen = false;
        void video.play();
      },
    });
  });

  // By now the timedtext fetches have had player-wait time to complete.
  const [koLines, zhLines, englishLines] = await timedtextPromise;

  const HANGUL = /[가-힯ᄀ-ᇿ㄰-㆏]/;
  const CJK    = /[一-鿿㐀-䶿]/;
  const sampleText = (lines: SubtitleLine[]) => lines.slice(0, 5).map((l) => l.text).join('');
  const scriptOf = (lines: SubtitleLine[]): 'ko' | 'zh' | null => {
    const s = sampleText(lines);
    if (HANGUL.test(s)) return 'ko';
    if (CJK.test(s)) return 'zh';
    return null;
  };

  // Detect from text content, not track code — YouTube sometimes mislabels tracks.
  let sourceLangLines: SubtitleLine[] | null = null;
  for (const lines of [koLines, zhLines]) {
    if (!lines) continue;
    const lang = scriptOf(lines);
    if (lang) { sourceLangLines = lines; detectedLang = lang; break; }
  }
  // Last resort: take whatever exists and trust the track code
  if (!sourceLangLines) {
    sourceLangLines = koLines ?? zhLines ?? null;
    detectedLang = sourceLangLines === zhLines ? 'zh' : 'ko';
  }

  console.log(
    '[translate-bot] detected:', detectedLang,
    '| source:', sourceLangLines?.length ?? 'none',
    '| english:', englishLines?.length ?? 'none',
  );

  // ── PRIMARY PATH ────────────────────────────────────────────────────────────
  if (sourceLangLines) {
    injectHideNativeCss();
    putTranscript(settings.backendUrl, videoId, detectedLang, sourceLangLines).catch(() => {});

    // Reuse the per-video map if this video was already seen in this tab (instant).
    // Otherwise create a fresh map and populate it from the DB cache.
    const tabCacheKey = `${videoId}:${detectedLang}`;
    if (!videoTranslations.has(tabCacheKey)) videoTranslations.set(tabCacheKey, new Map());
    romanMap = videoTranslations.get(tabCacheKey)!;

    if (romanMap.size === 0) {
      const cachedLines = await fetchAllCached(settings.backendUrl, videoId, detectedLang).catch(() => []);
      for (const c of cachedLines) romanMap.set(c.index, c);
    }

    const renderLine = (idx: number): void => {
      if (idx < 0) { overlay.clear(); clickedLineIndex = -1; return; }
      clickedLineIndex = idx;
      const roman = romanMap.get(idx);
      const original = sourceLangLines![idx]?.text ?? '';
      const ccText = englishLines
        ? findLineAtTime(englishLines, sourceLangLines![idx].startTime)?.text ?? ''
        : '';
      const translation = ccText || roman?.translation || '';
      const romanization = roman?.romanization || '';
      clickedLineText = original;
      clickedLineTranslation = translation;
      if (!romanization && !translation) { overlay.clear(); return; }
      overlay.setLine({ original, translation, romanization });
    };

    const sync = makePlayerSync({
      getTime: () => video.currentTime,
      lines: sourceLangLines,
      onChange: (idx) => renderLine(idx),
    });
    sync.start();

    // Poll every 300ms to pick up translations that arrived during gaps or while paused
    const poll = window.setInterval(() => renderLine(sync.currentIdx()), 300);

    const abort = new AbortController();

    const missing = sourceLangLines.filter((l) => {
      const c = romanMap.get(l.index);
      return !c || (!c.romanization && !c.translation);
    });

    if (missing.length > 0) {
      const ordered = [...missing].sort((a, b) => a.startTime - b.startTime);
      parallelRomanize(
        settings.backendUrl,
        videoId,
        detectedLang,
        ordered,
        abort.signal,
        video.currentTime,
        !!englishLines,
      );
    }

    teardown = () => {
      abort.abort();
      clearInterval(poll);
      sync.stop();
      overlay.unmount();
      removeBtn?.();
    };
    return;
  }

  // ── FALLBACK PATH ────────────────────────────────────────────────────────────
  console.log('[translate-bot] no source timedtext, falling back to DOM observer');
  const container = await waitFor<HTMLElement>(
    () => document.querySelector<HTMLElement>('.ytp-caption-window-container'),
  );
  if (!container) {
    console.warn('[translate-bot] caption container not found');
    return;
  }
  injectHideNativeCss();

  let fallbackIndex = 0;
  const HANGUL_FB = /[가-힯ᄀ-ᇿ]/;
  const CJK_FB    = /[一-鿿㐀-䶿]/;

  const stopObs = observeCaptions(container, async (text) => {
    // Skip if text isn't Korean or Chinese — no point sending English to Claude
    if (!HANGUL_FB.test(text) && !CJK_FB.test(text)) return;

    const captureTime = video.currentTime;
    const index = fallbackIndex++;
    clickedLineIndex = index;

    const engLine = englishLines ? findLineAtTime(englishLines, captureTime) : null;

    overlay.setLine({ original: text, translation: engLine?.text ?? '', romanization: '' });

    try {
      const out = await translateLines(settings.backendUrl, {
        videoId,
        sourceLang: detectedLang,
        targetLang: 'en',
        lines: [{ index, text }],
      });
      const o = out[0];
      if (o) {
        romanMap.set(index, o);
        overlay.setLine({
          original: text,
          translation: engLine?.text ?? o.translation,
          romanization: o.romanization,
        });
      }
    } catch (e) {
      console.warn('[translate-bot] per-line translate failed', e);
    }
  });

  teardown = () => { stopObs(); overlay.unmount(); removeBtn?.(); };
}

function restart(): void {
  if (teardown) teardown();
  teardown = null;
  history = [];
  void start();
}

console.log('[translate-bot] content script loaded on', location.href);
onNavigate(() => restart());
void start();
