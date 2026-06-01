import { describe, it, expect } from 'vitest';
import { buildChatPrompt, type TranscriptLine } from '../src/lib/promptBuilder';
import type { ChatMessage } from '../src/anthropic';

const transcript: TranscriptLine[] = Array.from({ length: 30 }, (_, i) => ({
  index: i,
  text: `line ${i}`,
  translation: `t${i}`,
  startTime: i,
  endTime: i + 1,
}));

describe('buildChatPrompt', () => {
  it('includes anchored window of 10 before + 5 after the clicked line', () => {
    const { messages } = buildChatPrompt({
      transcript,
      sourceLang: 'zh',
      clickedLineIndex: 15,
      history: [],
      question: 'what does this mean?',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).toContain('line 5');
    expect(user).toContain('line 15');
    expect(user).toContain('line 20');
    expect(user).not.toContain('line 4');
    expect(user).not.toContain('line 21');
  });

  it('adds retrieved context when query has backward cue', () => {
    const t: TranscriptLine[] = [
      { index: 0, text: 'My brother is a doctor.', translation: '' },
      ...Array.from({ length: 30 }, (_, i) => ({
        index: i + 1,
        text: `unrelated ${i}`,
        translation: '',
      })),
    ];
    const { messages } = buildChatPrompt({
      transcript: t,
      sourceLang: 'zh',
      clickedLineIndex: 25,
      history: [],
      question: 'what did she say about her brother earlier?',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).toContain('Retrieved context');
    expect(user).toContain('brother');
  });

  it('does not retrieve when query has no backward cue', () => {
    const { messages } = buildChatPrompt({
      transcript,
      sourceLang: 'zh',
      clickedLineIndex: 15,
      history: [],
      question: 'what does this mean?',
    });
    const user = messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).not.toContain('Retrieved context');
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
