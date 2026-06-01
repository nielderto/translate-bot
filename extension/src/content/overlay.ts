export type FontSize = 'small' | 'medium' | 'large';

const SIZE_PX: Record<FontSize, number> = {
  small: 15,
  medium: 20,
  large: 26,
};

const STYLES = `
  :host { all: initial; }

  @keyframes tb-dot {
    0%, 80%, 100% { opacity: 0.15; transform: scale(0.8); }
    40%           { opacity: 1;    transform: scale(1);   }
  }

  @keyframes tb-bar {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(0); }
  }

  .block {
    position: absolute;
    left: 50%;
    bottom: 9%;
    transform: translateX(-50%);
    padding: 10px 22px 12px;
    border-radius: 8px;
    background: rgba(6, 6, 6, 0.68);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
    pointer-events: auto;
    max-width: 78%;
    user-select: none;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .block.hidden  { display: none; }

  /* ── original row: text + ask button inline ── */
  .original-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .ask-btn {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.55);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    padding: 0;
  }
  .ask-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.45);
    color: #fff;
  }

  /* ── subtitle tiers ── */
  .original {
    font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  .roman {
    font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
    font-weight: 400;
    color: rgba(160, 200, 255, 0.75);
    line-height: 1.4;
    margin-top: 3px;
    letter-spacing: 0.07em;
  }

  .translation {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.3;
    margin-top: 7px;
    padding-top: 7px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* ── loading dots (used in roman slot) ── */
  .dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }
  .dots span {
    display: inline-block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(160, 200, 255, 0.7);
    animation: tb-dot 1.2s ease-in-out infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }

  /* ── preparing card (replaces subtitle block while batch-translating) ── */
  .preparing {
    position: absolute;
    left: 50%;
    bottom: 9%;
    transform: translateX(-50%);
    padding: 14px 28px;
    border-radius: 8px;
    background: rgba(6, 6, 6, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .preparing.hidden { display: none; }

  .prep-label {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.6);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .prep-count {
    font-family: 'SF Mono', ui-monospace, monospace;
    font-size: 13px;
    color: rgba(160, 200, 255, 0.9);
  }

  .prep-track {
    width: 100%;
    height: 2px;
    background: rgba(255,255,255,0.1);
    border-radius: 1px;
    overflow: hidden;
  }
  .prep-fill {
    height: 100%;
    background: rgba(160, 200, 255, 0.7);
    border-radius: 1px;
    width: 0%;
    transition: width 0.4s ease;
  }
`;

export interface LineContent {
  original: string;
  translation: string;
  /** pass 'loading' to show animated dots */
  romanization: string | 'loading';
}

export interface Overlay {
  mount: (playerEl: HTMLElement) => void;
  setLine: (content: LineContent) => void;
  clear: () => void;
  setFontSize: (size: FontSize) => void;
  /** @deprecated use onAskClick — kept for callers that haven't migrated */
  onClick: (cb: () => void) => void;
  onAskClick: (cb: () => void) => void;
  showPreparing: (done: number, total: number) => void;
  hidePreparing: () => void;
  blockEl: () => HTMLDivElement | null;
  shadowRoot: () => ShadowRoot | null;
  unmount: () => void;
}

export function createOverlay(): Overlay {
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let block: HTMLDivElement | null = null;
  let preparingEl: HTMLDivElement | null = null;
  let prepFill: HTMLDivElement | null = null;
  let prepCount: HTMLDivElement | null = null;
  let originalEl: HTMLDivElement | null = null;
  let romanEl: HTMLDivElement | null = null;
  let translationEl: HTMLDivElement | null = null;
  let clickHandler: (() => void) | null = null;
  let askHandler: (() => void) | null = null;
  let askBtn: HTMLButtonElement | null = null;
  let fontPx: number = SIZE_PX.medium;

  const applyFont = (): void => {
    if (!originalEl || !romanEl || !translationEl) return;
    originalEl.style.fontSize = `${fontPx}px`;
    romanEl.style.fontSize   = `${Math.round(fontPx * 0.55)}px`;
    translationEl.style.fontSize = `${Math.round(fontPx * 0.7)}px`;
  };

  const makeDots = (): HTMLSpanElement => {
    const wrap = document.createElement('span');
    wrap.className = 'dots';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('span');
      wrap.appendChild(d);
    }
    return wrap;
  };

  const render = (): void => {
    if (!shadow) return;

    // ── preparing card ──
    preparingEl = document.createElement('div');
    preparingEl.className = 'preparing hidden';
    const prepLabel = document.createElement('div');
    prepLabel.className = 'prep-label';
    prepLabel.textContent = 'Compiling subtitles — ready to play soon';
    prepCount = document.createElement('div');
    prepCount.className = 'prep-count';
    const prepTrack = document.createElement('div');
    prepTrack.className = 'prep-track';
    prepFill = document.createElement('div');
    prepFill.className = 'prep-fill';
    prepTrack.appendChild(prepFill);
    preparingEl.append(prepLabel, prepCount, prepTrack);

    // ── subtitle block ──
    block = document.createElement('div');
    block.className = 'block hidden';

    // original text + ? button on the same row
    const originalRow = document.createElement('div');
    originalRow.className = 'original-row';
    originalEl = document.createElement('div');
    originalEl.className = 'original';
    askBtn = document.createElement('button');
    askBtn.className = 'ask-btn';
    askBtn.textContent = '?';
    askBtn.title = 'Ask about this line';
    askBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      askHandler?.();
      clickHandler?.();
    });
    originalRow.append(originalEl, askBtn);

    romanEl = document.createElement('div');
    romanEl.className = 'roman';
    translationEl = document.createElement('div');
    translationEl.className = 'translation';
    block.append(originalRow, romanEl, translationEl);

    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.append(style, preparingEl, block);
    applyFont();
  };

  return {
    mount(playerEl: HTMLElement): void {
      host = document.createElement('div');
      host.setAttribute('data-translate-bot-overlay', '');
      host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9999;';
      shadow = host.attachShadow({ mode: 'open' });
      playerEl.appendChild(host);
      render();
    },

    setLine({ original, translation, romanization }: LineContent): void {
      if (!block || !originalEl || !romanEl || !translationEl) return;
      block.classList.remove('hidden');
      originalEl.textContent = original;

      // romanization: animated dots while loading, text when ready, hidden if empty/same as translation
      romanEl.innerHTML = '';
      if (romanization === 'loading') {
        romanEl.appendChild(makeDots());
        romanEl.style.display = '';
      } else if (romanization && romanization !== translation) {
        romanEl.textContent = romanization;
        romanEl.style.display = '';
      } else {
        romanEl.style.display = 'none';
      }

      if (translation) {
        translationEl.textContent = translation;
        translationEl.style.display = '';
      } else {
        translationEl.textContent = '';
        translationEl.style.display = 'none';
      }
    },

    clear(): void {
      if (block) block.classList.add('hidden');
    },

    setFontSize(size: FontSize): void {
      fontPx = SIZE_PX[size] ?? SIZE_PX.medium;
      applyFont();
    },

    onClick(cb: () => void): void {
      clickHandler = cb;
    },

    onAskClick(cb: () => void): void {
      askHandler = cb;
    },

    showPreparing(done: number, total: number): void {
      if (!preparingEl || !prepFill || !prepCount) return;
      preparingEl.classList.remove('hidden');
      block?.classList.add('hidden');
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      prepFill.style.width = `${pct}%`;
      prepCount.textContent = `${done} / ${total} lines`;
    },

    hidePreparing(): void {
      if (!preparingEl) return;
      preparingEl.classList.add('hidden');
    },

    blockEl(): HTMLDivElement | null { return block; },
    shadowRoot(): ShadowRoot | null { return shadow; },

    unmount(): void {
      host?.remove();
      host = null; shadow = null; block = null; preparingEl = null;
      prepFill = null; prepCount = null;
      originalEl = null; romanEl = null; translationEl = null; askBtn = null;
    },
  };
}
