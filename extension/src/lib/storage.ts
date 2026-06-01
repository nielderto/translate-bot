export interface Settings {
  sourceLang: 'zh' | 'ko';
  targetLang: 'en';
  fontSize: 'small' | 'medium' | 'large';
  enabled: boolean;
  backendUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  sourceLang: 'zh',
  targetLang: 'en',
  fontSize: 'medium',
  enabled: true,
  backendUrl: 'http://localhost:3000',
};

const KEY = 'settings';

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([KEY], (data) => {
      const stored = (data[KEY] ?? {}) as Partial<Settings>;
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [KEY]: { ...current, ...partial } }, () => resolve());
  });
}
