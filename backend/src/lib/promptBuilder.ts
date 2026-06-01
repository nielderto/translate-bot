import { CHAT_SYSTEM } from '../prompts/chat';
import { hasBackwardCue, retrieveLines } from './retrieval';
import type { ChatMessage, SystemBlock } from '../anthropic';

const WINDOW_BEFORE = 10;
const WINDOW_AFTER = 5;
const HISTORY_LIMIT = 10;
const RETRIEVAL_TOP_N = 5;

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

export function buildChatPrompt(args: BuildChatPromptArgs): BuiltPrompt {
  const { transcript, sourceLang, clickedLineIndex, history, question } = args;

  const start = Math.max(0, clickedLineIndex - WINDOW_BEFORE);
  const end = Math.min(transcript.length - 1, clickedLineIndex + WINDOW_AFTER);
  const window = transcript.slice(start, end + 1);

  const parts: string[] = [];
  parts.push(`Source language: ${sourceLang}`);
  parts.push(`Current scene (around clicked line ${clickedLineIndex}):`);
  parts.push(window.map(fmtLine).join('\n'));

  if (hasBackwardCue(question)) {
    const retrieved = retrieveLines(transcript, question, RETRIEVAL_TOP_N).filter(
      (l) => l.index < start || l.index > end,
    );
    if (retrieved.length > 0) {
      parts.push('\nRetrieved context (from earlier in the video):');
      parts.push(retrieved.map(fmtLine).join('\n'));
    }
  }

  parts.push(`\nUser question: ${question}`);

  const messages: ChatMessage[] = [];
  for (const h of history.slice(-HISTORY_LIMIT)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: parts.join('\n') });

  const system: SystemBlock[] = [{ type: 'text', text: CHAT_SYSTEM }];

  return { system, messages };
}
