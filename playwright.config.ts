import { defineConfig } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from e2e/ directory if present.
dotenv.config({ path: path.resolve(__dirname, '.env') });

const config = defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  timeout: 180_000,
  globalTimeout: 600_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: path.resolve(__dirname, 'test-results'), open: 'never' }]],
  globalSetup: path.resolve(__dirname, 'helpers', 'globalSetup.ts'),
  use: {
    // Electron tests do not use a browser — settings here are for type completeness only.
    trace: 'on-first-retry',
  },
});

export default config;
