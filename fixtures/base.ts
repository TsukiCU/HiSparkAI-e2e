/**
 * base.ts — Shared Playwright test fixture
 *
 * Launches VSCode (Electron) with the HiSpark Studio AI extension loaded in
 * development mode. All test files import `test` and `expect` from here.
 *
 * Required environment variables (set in e2e/.env, see .env.example):
 *   VSCODE_EXECUTABLE_PATH  — absolute path to the VSCode Electron binary
 *   EXTENSION_DEVELOPMENT_PATH — absolute path to the code/ directory
 *   DATA_DIR — absolute path to the repo data/ directory
 */

import { test as base, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Environment variable ${name} is not set. ` +
      'Copy e2e/.env.example to e2e/.env and fill in all required variables.'
    );
  }
  return val;
}

export const VSCODE_EXECUTABLE_PATH = requireEnv('VSCODE_EXECUTABLE_PATH');
export const EXTENSION_DEVELOPMENT_PATH = requireEnv('EXTENSION_DEVELOPMENT_PATH');
export const DATA_DIR = requireEnv('DATA_DIR');

// Derived data paths — use path.resolve to avoid cross-platform issues.
export const CALI_DIR = path.resolve(DATA_DIR, 'cali');
export const VALI_DIR = path.resolve(DATA_DIR, 'vali');
export const LABEL_CSV = path.resolve(DATA_DIR, 'label.csv');

type BaseFixtures = {
  app: ElectronApplication;
  electronPage: Page;
};

export const test = base.extend<BaseFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({
      executablePath: VSCODE_EXECUTABLE_PATH,
      args: [
        `--extensionDevelopmentPath=${EXTENSION_DEVELOPMENT_PATH}`,
        '--disable-workspace-trust',
        '--no-sandbox',
        '--disable-gpu',
        // Suppress VSCode's first-run UX that can obstruct the sidebar.
        '--skip-release-notes',
        '--disable-telemetry',
      ],
    });
    await use(app);
    await app.close();
  },

  electronPage: async ({ app }, use) => {
    const page = await app.firstWindow();
    await use(page);
  },
});

export { expect };
