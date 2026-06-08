import { CHAT_SYSTEM } from '../prompts/chat';
import type { ChatMessage, SystemBlock } from '../anthropic';

const PARAGRAPH_GAP_MS = 2500;
const MAX_LINES_EACH_SIDE = 8;
const FALLBACK_BEFORE = 4;
const FALLBACK_AFTER = 3;
const HISTORY_LIMIT = 10;

export interface TranscriptLine {
  index: number;
  text: string;
  translation?: string;
  startTime?: number;
  endTime?: number;
}

export interface BuildChatPromptArgs {
  transcript: TranscriptLine[];
  sourceLang: string;
  clickedLineIndex: number;
  history: ChatMessage[];
  question: string;
}

export interface BuiltPrompt {
  system: SystemBlock[];
  messages: ChatMessage[];
}

function fmtLine(l: TranscriptLine): string {
  return `[${l.index}] ${l.text}${l.translation ? ` — ${l.translation}` : ''}`;
}

function getParagraphBounds(
  transcript: TranscriptLine[],
  clickedLineIndex: number,
): { start: number; end: number } {
  const idx = clickedLineIndex;

  // No timing info — fall back to small fixed window
  if (!transcript[idx]?.startTime) {
    return {
      start: Math.max(0, idx - FALLBACK_BEFORE),
      end: Math.min(transcript.length - 1, idx + FALLBACK_AFTER),
    };
  }

  // Walk backward until a long pause or max lines
  let start = idx;
  while (start > 0 && idx - start < MAX_LINES_EACH_SIDE) {
    const prev = transcript[start - 1]!;
    const curr = transcript[start]!;
    if (prev.endTime !== undefined && curr.startTime !== undefined
        && curr.startTime - prev.endTime > PARAGRAPH_GAP_MS) break;
    start--;
  }

  // Walk forward until a long pause or max lines
  let end = idx;
  while (end < transcript.length - 1 && end - idx < MAX_LINES_EACH_SIDE) {
    const curr = transcript[end]!;
    const next = transcript[end + 1]!;
    if (curr.endTime !== undefined && next.startTime !== undefined
        && next.startTime - curr.endTime > PARAGRAPH_GAP_MS) break;
    end++;
  }

  return { start, end };
}

export function buildChatPrompt(args: BuildChatPromptArgs): BuiltPrompt {
  const { transcript, sourceLang, clickedLineIndex, history, question } = args;

  const { start, end } = getParagraphBounds(transcript, clickedLineIndex);
  const paragraph = transcript.slice(start, end + 1);

  const parts: string[] = [];
  parts.push(`Source language: ${sourceLang}`);
  parts.push(`Current paragraph (lines ${start}–${end}, clicked line ${clickedLineIndex}):`);
  parts.push(paragraph.map(fmtLine).join('\n'));
  parts.push(`\nUser question: ${question}`);

  const messages: ChatMessage[] = [];
  for (const h of history.slice(-HISTORY_LIMIT)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: parts.join('\n') });

  const system: SystemBlock[] = [{ type: 'text', text: CHAT_SYSTEM }];

  return { system, messages };
}
