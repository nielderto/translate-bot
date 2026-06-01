import { test, chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extPath = resolve(__dirname, '../dist');
const fixture = `file://${resolve(__dirname, 'fixture.html')}`;

test('overlay mounts and renders on a captioned page', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  });
  const page = await context.newPage();
  await page.goto(fixture);

  await page.waitForSelector('[data-translate-bot-overlay]', { timeout: 5000 });
  await context.close();
});
