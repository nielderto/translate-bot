import { describe, it, expect, vi, afterEach } from 'vitest';
import { injectPlayerButton, type PlayerButtonSettings, type PlayerButtonHandle } from '../src/content/playerButton';

function makeSettings(): PlayerButtonSettings {
  return {
    getSize: () => 'medium',
    onSizeChange: vi.fn(),
    getSourceLang: () => 'zh',
    onSourceLangChange: vi.fn(),
    getEnabled: () => true,
    onEnabledChange: vi.fn(),
  };
}

function makeAnchor(parent: HTMLElement = document.body): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ytp-time-display';
  parent.appendChild(el);
  return el;
}

afterEach(() => {
  document.getElementById('tb-btn-prev')?.remove();
  document.getElementById('tb-btn-translate')?.remove();
  document.getElementById('tb-btn-next')?.remove();
  document.getElementById('tb-player-popup')?.remove();
  vi.useRealTimers();
});

describe('injectPlayerButton', () => {
  it('returns a handle object with teardown and setNavReady', () => {
    const anchor = makeAnchor();
    const handle = injectPlayerButton(anchor, makeSettings(), { onPrev: vi.fn(), onNext: vi.fn() });
    expect(typeof handle.teardown).toBe('function');
    expect(typeof handle.setNavReady).toBe('function');
    handle.teardown();
    anchor.remove();
  });

  it('teardown removes buttons and popup', () => {
    const anchor = makeAnchor();
    const { teardown } = injectPlayerButton(anchor, makeSettings(), { onPrev: vi.fn(), onNext: vi.fn() });
    teardown();
    expect(document.getElementById('tb-btn-prev')).toBeNull();
    expect(document.getElementById('tb-btn-translate')).toBeNull();
    expect(document.getElementById('tb-btn-next')).toBeNull();
    expect(document.getElementById('tb-player-popup')).toBeNull();
    anchor.remove();
  });

  it('re-injects buttons via fresh ytp-time-display query when original anchor is detached', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const anchor = makeAnchor(container);
    document.body.appendChild(container);

    const { teardown } = injectPlayerButton(anchor, makeSettings(), { onPrev: vi.fn(), onNext: vi.fn() });

    // YouTube tears down the entire controls bar (old anchor now detached)
    container.remove();

    // YouTube re-creates controls bar with a fresh .ytp-time-display
    const newContainer = document.createElement('div');
    const newAnchor = document.createElement('div');
    newAnchor.className = 'ytp-time-display';
    newContainer.appendChild(newAnchor);
    document.body.appendChild(newContainer);

    vi.advanceTimersByTime(1100);

    expect(document.getElementById('tb-btn-prev')?.parentElement).toBe(newContainer);

    teardown();
    newContainer.remove();
  });

  it('nav buttons are disabled before setNavReady and enabled after', () => {
    const anchor = makeAnchor();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const { teardown, setNavReady } = injectPlayerButton(anchor, makeSettings(), { onPrev, onNext });

    const prev = document.getElementById('tb-btn-prev') as HTMLButtonElement;
    const next = document.getElementById('tb-btn-next') as HTMLButtonElement;

    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);

    prev.click();
    next.click();
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();

    setNavReady(true);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    prev.click();
    next.click();
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();

    teardown();
    anchor.remove();
  });
});
