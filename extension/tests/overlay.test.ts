import { describe, it, expect, vi } from 'vitest';
import { createOverlay } from '../src/content/overlay';

function makePlayer(): HTMLDivElement {
  const p = document.createElement('div');
  p.className = 'html5-video-player';
  document.body.appendChild(p);
  return p;
}

describe('overlay', () => {
  it('mounts into the player and renders three stacked lines', () => {
    const player = makePlayer();
    const o = createOverlay();
    o.mount(player);
    o.setLine({ original: '你好', translation: 'Hello', romanization: 'nǐ hǎo' });

    const host = player.querySelector('[data-translate-bot-overlay]');
    expect(host).toBeTruthy();
    const root = (host as HTMLElement).shadowRoot;
    expect(root?.querySelector('.original')?.textContent).toBe('你好');
    expect(root?.querySelector('.roman')?.textContent).toBe('nǐ hǎo');
    expect(root?.querySelector('.translation')?.textContent).toBe('Hello');
    o.unmount();
    document.body.removeChild(player);
  });

  it('fires onClick when the block is clicked', () => {
    const player = makePlayer();
    const o = createOverlay();
    o.mount(player);
    const cb = vi.fn();
    o.onClick(cb);
    o.setLine({ original: 'a', translation: 'b', romanization: 'c' });
    const host = player.querySelector('[data-translate-bot-overlay]') as HTMLElement;
    (host.shadowRoot?.querySelector('.block') as HTMLElement).click();
    expect(cb).toHaveBeenCalled();
    o.unmount();
    document.body.removeChild(player);
  });

  it('clear hides the block', () => {
    const player = makePlayer();
    const o = createOverlay();
    o.mount(player);
    o.setLine({ original: 'a', translation: 'b', romanization: 'c' });
    o.clear();
    const host = player.querySelector('[data-translate-bot-overlay]') as HTMLElement;
    const block = host.shadowRoot?.querySelector('.block') as HTMLElement;
    expect(block.classList.contains('hidden')).toBe(true);
    o.unmount();
    document.body.removeChild(player);
  });
});
