import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/share-cards',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3107',
    ...devices['Desktop Chrome'],
    channel: 'chromium',
  },
  webServer: {
    command: 'npx next dev --hostname 127.0.0.1 --port 3107',
    url: 'http://127.0.0.1:3107/dev/share-cards',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
