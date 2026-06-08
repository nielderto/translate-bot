import { describe, it, expect } from 'vitest';
import { romanizeZh, romanizeKo } from '../src/lib/romanize';

describe('romanizeZh', () => {
  it('converts common Chinese greetings to pinyin with tone marks', () => {
    expect(romanizeZh('你好')).toBe('nǐ hǎo');
  });

  it('converts multi-character phrase with tones', () => {
    expect(romanizeZh('谢谢')).toBe('xiè xiè');
  });

  it('handles mixed Chinese and punctuation', () => {
    const result = romanizeZh('你好吗？');
    expect(result).toContain('nǐ');
    expect(result).toContain('hǎo');
    expect(result).toContain('ma');
  });

  it('returns empty string for empty input', () => {
    expect(romanizeZh('')).toBe('');
  });

  it('returns non-Chinese text unchanged', () => {
    expect(romanizeZh('hello')).toBe('hello');
  });
});

describe('romanizeKo', () => {
  it('converts Korean greeting to Revised Romanization', () => {
    expect(romanizeKo('안녕하세요').toLowerCase()).toBe('annyeonghaseyo');
  });

  it('converts common Korean phrase (orthographic, without nasalization)', () => {
    // hangul-romanization applies Revised Romanization without phonological assimilation rules.
    // 감사합니다 is orthographically "gamsahapnida"; the spoken form is "gamsahamnida".
    expect(romanizeKo('감사합니다').toLowerCase()).toBe('gamsahapnida');
  });

  it('returns empty string for empty input', () => {
    expect(romanizeKo('')).toBe('');
  });

  it('handles mixed Korean and spaces', () => {
    const result = romanizeKo('잘 지냈어요');
    expect(result.toLowerCase()).toContain('jal');
  });
});
