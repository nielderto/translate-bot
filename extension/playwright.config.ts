import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { headless: false },
  timeout: 30000,
  workers: 1,
});
