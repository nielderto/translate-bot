import { getSettings, setSettings, type Settings } from '../lib/storage';

const $ = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

async function init(): Promise<void> {
  const s = await getSettings();

  const enabled = $<HTMLInputElement>('#enabled');
  const fontSize = $<HTMLSelectElement>('#fontSize');
  const backendUrl = $<HTMLInputElement>('#backendUrl');
  const srcRadio = document.querySelector<HTMLInputElement>(
    `input[name="src"][value="${s.sourceLang}"]`,
  );

  if (enabled) enabled.checked = s.enabled;
  if (fontSize) fontSize.value = s.fontSize;
  if (backendUrl) backendUrl.value = s.backendUrl;
  if (srcRadio) srcRadio.checked = true;

  enabled?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    void setSettings({ enabled: target.checked });
  });

  document.querySelectorAll<HTMLInputElement>('input[name="src"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      void setSettings({ sourceLang: target.value as Settings['sourceLang'] });
    });
  });

  fontSize?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    void setSettings({ fontSize: target.value as Settings['fontSize'] });
  });

  backendUrl?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    void setSettings({ backendUrl: target.value });
  });
}

void init();
