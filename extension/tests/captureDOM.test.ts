import { describe, it, expect, vi } from 'vitest';
import { observeCaptions } from '../src/content/captureDOM';

describe('observeCaptions', () => {
  it('fires onChange when caption text appears', async () => {
    const container = document.createElement('div');
    container.className = 'ytp-caption-window-container';
    document.body.appendChild(container);

    const onChange = vi.fn();
    const stop = observeCaptions(container, onChange);

    const seg = document.createElement('span');
    seg.className = 'ytp-caption-segment';
    seg.textContent = '你好';
    container.appendChild(seg);

    await new Promise((r) => setTimeout(r, 60));
    expect(onChange).toHaveBeenCalledWith('你好');
    stop();
    document.body.removeChild(container);
  });

  it('debounces multiple rapid mutations into one callback', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onChange = vi.fn();
    const stop = observeCaptions(container, onChange);

    const seg = document.createElement('span');
    seg.className = 'ytp-caption-segment';
    container.appendChild(seg);
    seg.textContent = 'a';
    seg.textContent = 'ab';
    seg.textContent = 'abc';

    await new Promise((r) => setTimeout(r, 100));
    expect(onChange).toHaveBeenLastCalledWith('abc');
    stop();
    document.body.removeChild(container);
  });
});
