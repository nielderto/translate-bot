import { describe, it, expect } from 'vitest';
import { buildChatPrompt, type TranscriptLine } from '../src/lib/promptBuilder';
import type { ChatMessage } from '../src/anthropic';

// Transcript where lines are 1ms each with 0ms gaps — no paragraph breaks.
const transcript: TranscriptLine[] = Array.from({ length: 30 }, (_, i) => ({
  index: i,
  text: `line ${i}`,
  translation: `t${i}`,
  startTime: i,
  endTime: i + 1,
}));

describe('buildChatPrompt', () => {
  it('expands up to MAX_LINES_EACH_SIDE (8) when no paragraph gaps exist', () => {
    const { messages } = buildChatPrompt({
      transcript,
      sourceLang: 'zh',
      clickedLineIndex: 15,
      history: [],
      question: 'what does this mean?',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    // start = 15 - 8 = 7, end = 15 + 8 = 23
    expect(user).toContain('line 7');
    expect(user).toContain('line 15');
    expect(user).toContain('line 23');
    expect(user).not.toContain('line 6');
    expect(user).not.toContain('line 24');
  });

  it('stops at a paragraph gap (>2500ms silence)', () => {
    // Lines 0–4 are one paragraph, then a 5-second gap, then lines 5–20.
    const gapped: TranscriptLine[] = [
      ...Array.from({ length: 5 }, (_, i) => ({ index: i, text: `early ${i}`, startTime: i * 1000, endTime: i * 1000 + 900 })),
      ...Array.from({ length: 16 }, (_, i) => ({ index: i + 5, text: `later ${i}`, startTime: 10000 + i * 1000, endTime: 10000 + i * 1000 + 900 })),
    ];
    const { messages } = buildChatPrompt({
      transcript: gapped,
      sourceLang: 'zh',
      clickedLineIndex: 7,
      history: [],
      question: 'q',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    // Paragraph starts at line 5 (right after the gap), not line 4 or earlier
    expect(user).toContain('later 2');  // line 7
    expect(user).toContain('later 0');  // line 5 — paragraph start
    expect(user).not.toContain('early'); // lines 0–4 are across the gap
  });

  it('does not include whole-video retrieval', () => {
    const { messages } = buildChatPrompt({
      transcript,
      sourceLang: 'zh',
      clickedLineIndex: 15,
      history: [],
      question: 'what did she say about her brother earlier?',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).not.toContain('Retrieved context');
  });

  it('falls back to small fixed window when no timing info', () => {
    const noTime: TranscriptLine[] = Array.from({ length: 20 }, (_, i) => ({
      index: i,
      text: `line ${i}`,
    }));
    const { messages } = buildChatPrompt({
      transcript: noTime,
      sourceLang: 'ko',
      clickedLineIndex: 10,
      history: [],
      question: 'q',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    // FALLBACK_BEFORE=4, FALLBACK_AFTER=3 → lines 6–13
    expect(user).toContain('line 6');
    expect(user).toContain('line 13');
    expect(user).not.toContain('line 5');
    expect(user).not.toContain('line 14');
  });

  it('passes last 10 history turns verbatim', () => {
    const history: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `turn ${i}`,
    }));
    const { messages } = buildChatPrompt({
      transcript,
      sourceLang: 'zh',
      clickedLineIndex: 15,
      history,
      question: 'q',
    });
    expect(messages.find((m) => m.content === 'turn 11')).toBeTruthy();
    expect(messages.find((m) => m.content === 'turn 0')).toBeFalsy();
  });

  it('system prompt instructs English-only responses', () => {
    const { system } = buildChatPrompt({
      transcript,
      sourceLang: 'zh',
      clickedLineIndex: 15,
      history: [],
      question: 'q',
    });
    expect(system[0]?.text).toMatch(/respond in English/i);
  });
});
