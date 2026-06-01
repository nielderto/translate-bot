const BUTTON_ID = 'tb-player-btn';

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
  <path d="M12.87 15.07l-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17A15.5 15.5 0 0 1 9 11.35 15.2 15.2 0 0 1 6.69 8h-2a17.2 17.2 0 0 0 2.98 4.56L2.58 17.6 4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2L18.5 10zm-2.62 7 1.62-4.33L19.12 17h-3.24z"/>
</svg>`;

export function injectPlayerButton(onClick: () => void): () => void {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) existing.remove();

  const timeDisplay = document.querySelector('.ytp-time-display');
  if (!timeDisplay || !timeDisplay.parentElement) return () => {};

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.className = 'ytp-button';
  btn.title = 'Translate Bot';
  btn.innerHTML = ICON_SVG;
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 100%;
    opacity: 0.9;
    color: #fff;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    vertical-align: top;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.9'; });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  timeDisplay.insertAdjacentElement('afterend', btn);

  return () => btn.remove();
}
