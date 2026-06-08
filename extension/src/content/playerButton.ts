import type { FontSize } from './overlay';

const POPUP_ID = 'tb-player-popup';
const ANCHOR_SELECTOR = '.ytp-time-display';

const ICON_TRANSLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
  <path d="M12.87 15.07l-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17A15.5 15.5 0 0 1 9 11.35 15.2 15.2 0 0 1 6.69 8h-2a17.2 17.2 0 0 0 2.98 4.56L2.58 17.6 4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2L18.5 10zm-2.62 7 1.62-4.33L19.12 17h-3.24z"/>
</svg>`;

export interface PlayerButtonSettings {
  getSize:            () => FontSize;
  onSizeChange:       (v: FontSize) => void;
  getSourceLang:      () => 'zh' | 'ko';
  onSourceLangChange: (v: 'zh' | 'ko') => void;
  getEnabled:         () => boolean;
  onEnabledChange:    (v: boolean) => void;
}

export interface PlayerButtonHandle {
  teardown: () => void;
  /** Call once subtitle lines are ready so prev/next buttons become active. */
  setNavReady: (ready: boolean) => void;
}

function positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
  popup.style.left   = '-9999px';
  popup.style.top    = '-9999px';
  popup.style.display = 'block';
  const r  = anchor.getBoundingClientRect();
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  popup.style.left = `${Math.max(4, r.left + r.width / 2 - pw / 2)}px`;
  popup.style.top  = `${r.top - ph - 8}px`;
}

export function injectPlayerButton(
  anchor: Element,
  s: PlayerButtonSettings,
  nav: { onPrev: () => void; onNext: () => void },
): PlayerButtonHandle {
  document.getElementById(POPUP_ID)?.remove();

  if (!anchor.parentElement) {
    console.warn('[translate-bot] anchor detached');
    return { teardown: () => {}, setNavReady: () => {} };
  }

  // ── settings popup ──────────────────────────────────────────────────────────
  const popup = document.createElement('div');
  popup.id = POPUP_ID;
  popup.style.cssText = `
    display:none;position:fixed;z-index:2147483647;width:220px;
    background:rgba(18,18,18,0.97);border:1px solid rgba(255,255,255,0.12);
    border-radius:10px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.7);
    font-family:system-ui,-apple-system,sans-serif;
  `;
  document.body.appendChild(popup);

  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,.07);font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.4)';
  hdr.textContent = 'Translate Bot';
  popup.appendChild(hdr);

  const addSection = (title: string): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,.07)';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:8px';
    lbl.textContent = title;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    wrap.append(lbl, row);
    popup.appendChild(wrap);
    return row;
  };

  const chip = (row: HTMLDivElement, label: string, active: boolean, onClick: () => void): void => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `padding:4px 10px;border-radius:20px;border:1px solid;cursor:pointer;font-size:12px;
      border-color:${active ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.15)'};
      background:${active ? 'rgba(255,255,255,.15)' : 'transparent'};
      color:${active ? '#fff' : 'rgba(255,255,255,.5)'};font-weight:${active ? 600 : 400};`;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    row.appendChild(b);
  };

  const renderPopup = (): void => {
    popup.querySelectorAll('.tb-s').forEach((el) => el.remove());

    const langRow = addSection('Learning');
    langRow.parentElement!.classList.add('tb-s');
    chip(langRow, 'Chinese', s.getSourceLang() === 'zh', () => { s.onSourceLangChange('zh'); renderPopup(); });
    chip(langRow, 'Korean',  s.getSourceLang() === 'ko', () => { s.onSourceLangChange('ko'); renderPopup(); });

    const sizeRow = addSection('Subtitle size');
    sizeRow.parentElement!.classList.add('tb-s');
    for (const [v, l] of [['small','S'],['medium','M'],['large','L']] as const) {
      chip(sizeRow, l, s.getSize() === v, () => { s.onSizeChange(v); renderPopup(); });
    }

    const enWrap = document.createElement('div');
    enWrap.className = 'tb-s';
    enWrap.style.cssText = 'padding:10px 14px;display:flex;align-items:center;justify-content:space-between';
    const on = s.getEnabled();
    const enLbl = document.createElement('span');
    enLbl.style.cssText = 'font-size:13px;color:rgba(255,255,255,.75)';
    enLbl.textContent = 'Show subtitles';
    const tog = document.createElement('button');
    tog.style.cssText = `width:36px;height:20px;border-radius:10px;border:none;cursor:pointer;position:relative;
      background:${on ? '#4a9eff' : 'rgba(255,255,255,.2)'};`;
    const knob = document.createElement('span');
    knob.style.cssText = `position:absolute;top:2px;left:${on ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:#fff`;
    tog.appendChild(knob);
    tog.addEventListener('click', (e) => { e.stopPropagation(); s.onEnabledChange(!on); renderPopup(); });
    enWrap.append(enLbl, tog);
    popup.appendChild(enWrap);
  };
  renderPopup();

  let popupOpen = false;
  const openPopup  = (): void => { renderPopup(); positionPopup(popup, tBtn); popupOpen = true; };
  const closePopup = (): void => { popup.style.display = 'none'; popupOpen = false; };
  const onDocClick = (e: MouseEvent): void => {
    if (popupOpen && !popup.contains(e.target as Node) && e.target !== tBtn) closePopup();
  };
  document.addEventListener('click', onDocClick);

  // ── the three buttons ────────────────────────────────────────────────────────
  const prevBtn = document.createElement('button');
  prevBtn.id        = 'tb-btn-prev';
  prevBtn.className = 'ytp-button';
  prevBtn.title     = 'Previous subtitle';
  prevBtn.disabled  = true;
  prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`;
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!prevBtn.disabled) nav.onPrev(); });

  const tBtn = document.createElement('button');
  tBtn.id        = 'tb-btn-translate';
  tBtn.className = 'ytp-button';
  tBtn.title     = 'Translate Bot settings';
  tBtn.innerHTML = ICON_TRANSLATE;
  tBtn.addEventListener('click', (e) => { e.stopPropagation(); popupOpen ? closePopup() : openPopup(); });

  const nextBtn = document.createElement('button');
  nextBtn.id        = 'tb-btn-next';
  nextBtn.className = 'ytp-button';
  nextBtn.title     = 'Next subtitle';
  nextBtn.disabled  = true;
  nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 8.5 6V6z" transform="scale(-1,1) translate(-24,0)"/></svg>`;
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!nextBtn.disabled) nav.onNext(); });

  anchor.after(prevBtn, tBtn, nextBtn);
  console.log('[translate-bot] injected, prev in DOM:', !!prevBtn.parentElement);

  // Re-inject if YouTube removes our buttons. Use isConnected (not parentElement)
  // so we also catch the case where YouTube replaces the entire controls bar —
  // in that scenario prevBtn still has a parentElement but it's a detached node.
  // Always query a fresh anchor so a controls-bar re-render doesn't strand buttons.
  const guard = window.setInterval(() => {
    if (!prevBtn.isConnected) {
      const freshAnchor = document.querySelector(ANCHOR_SELECTOR);
      if (freshAnchor?.parentElement) freshAnchor.after(prevBtn, tBtn, nextBtn);
    }
  }, 1000);

  return {
    teardown(): void {
      clearInterval(guard);
      document.removeEventListener('click', onDocClick);
      prevBtn.remove(); tBtn.remove(); nextBtn.remove();
      popup.remove();
    },
    setNavReady(ready: boolean): void {
      prevBtn.disabled = !ready;
      nextBtn.disabled = !ready;
    },
  };
}
