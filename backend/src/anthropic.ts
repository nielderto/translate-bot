import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TRANSLATE_SYSTEM, buildTranslateUser, type InputLine } from './prompts/translate';

const MODEL = 'claude-haiku-4-5-20251001';

export type SourceLang = 'zh' | 'ko';

export interface TranslatedLine {
  index: number;
  translation: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SystemBlock {
  type: 'text';
  text: string;
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function* streamTranslateBatch(
  lines: InputLine[],
  sourceLang: SourceLang,
): AsyncGenerator<TranslatedLine> {
  const stream = getClient().beta.promptCaching.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: [{ type: 'text', text: TRANSLATE_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user', content: buildTranslateUser(lines, sourceLang) },
      { role: 'assistant', content: '[' },
    ],
  });

  let buf = '';
  type State = 'between' | 'item' | 'string' | 'escape';
  let state: State = 'between';
  let depth = 0;
  let itemStart = -1;

  for await (const event of stream) {
    if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;
    for (const ch of event.delta.text) {
      buf += ch;
      switch (state) {
        case 'between':
          if (ch === '[') { state = 'item'; depth = 1; itemStart = buf.length - 1; }
          break;
        case 'item':
          if (ch === '[') { depth++; }
          else if (ch === ']') {
            depth--;
            if (depth === 0) {
              try {
                const arr = JSON.parse(buf.slice(itemStart)) as [number | string, string];
                yield { index: Number(arr[0]), translation: arr[1] };
              } catch (e) {
                console.warn('[translate-bot] failed to parse streamed item:', buf.slice(itemStart), e);
              }
              buf = '';
              itemStart = 0;
              state = 'between';
            }
          } else if (ch === '"') { state = 'string'; }
          break;
        case 'string':
          if (ch === '\\') { state = 'escape'; }
          else if (ch === '"') { state = 'item'; }
          break;
        case 'escape':
          state = 'string';
          break;
      }
    }
  }
}

async function callTranslate(
  lines: InputLine[],
  sourceLang: SourceLang,
): Promise<TranslatedLine[]> {
  const res = await getClient().beta.promptCaching.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: [{ type: 'text', text: TRANSLATE_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user', content: buildTranslateUser(lines, sourceLang) },
      { role: 'assistant', content: '[' },
    ],
  });

  const body = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  const text = '[' + body;
  return (JSON.parse(text) as [number | string, string][]).map(([index, translation]) => ({
    index: Number(index),
    translation,
  }));
}

export async function translateBatch(
  lines: InputLine[],
  sourceLang: SourceLang,
): Promise<TranslatedLine[]> {
  try {
    return await callTranslate(lines, sourceLang);
  } catch (err) {
    if (lines.length <= 1) throw err;
    const mid = Math.floor(lines.length / 2);
    const [a, b] = await Promise.all([
      callTranslate(lines.slice(0, mid), sourceLang).catch(() => [] as TranslatedLine[]),
      callTranslate(lines.slice(mid), sourceLang).catch(() => [] as TranslatedLine[]),
    ]);
    return [...a, ...b];
  }
}

export async function* streamChat(args: {
  system: SystemBlock[];
  messages: ChatMessage[];
}): AsyncGenerator<string, void, unknown> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: args.system,
    messages: args.messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
