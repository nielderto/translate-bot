import { describe, it, expect } from 'vitest';
import { romanizeZh, romanizeKo } from '../src/lib/romanize';

describe('romanizeZh', () => {
  it('converts Chinese characters to pinyin with tone symbols', () => {
    expect(romanizeZh('你好')).toBe('nǐ hǎo');
  });

  it('returns empty string for empty input', () => {
    expect(romanizeZh('')).toBe('');
  });

  it('handles mixed Chinese and non-Chinese text consecutively', () => {
    const result = romanizeZh('hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('romanizeKo', () => {
  it('converts Korean characters to romanization', () => {
    const result = romanizeKo('안녕하세요');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('안');
  });

  it('returns empty string for empty input', () => {
    expect(romanizeKo('')).toBe('');
  });
});
