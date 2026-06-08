import { getSettings, setSettings } from '../lib/storage';

async function init(): Promise<void> {
  const s = await getSettings();
  const backendUrl = document.querySelector<HTMLInputElement>('#backendUrl');
  if (backendUrl) {
    backendUrl.value = s.backendUrl;
    backendUrl.addEventListener('change', (e) => {
      void setSettings({ backendUrl: (e.target as HTMLInputElement).value });
    });
  }
}

void init();
