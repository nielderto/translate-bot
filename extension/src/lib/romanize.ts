import { pinyin } from 'pinyin-pro';
import Romanization from 'hangul-romanization';

export function romanizeZh(text: string): string {
  if (!text) return '';
  return pinyin(text, { toneType: 'symbol', type: 'string', separator: ' ', nonZh: 'consecutive' });
}

export function romanizeKo(text: string): string {
  if (!text) return '';
  return Romanization.convert(text);
}
