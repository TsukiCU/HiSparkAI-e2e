/**
 * base.ts — Shared Playwright test fixture
 *
 * Launches VSCode / Cursor (Electron) with the HiSpark Studio AI extension
 * loaded in development mode and exposes the app + main window page to
 * derived fixtures.
 *
 * Required environment variables (set in e2e/.env, see .env.example):
 *   VSCODE_EXECUTABLE_PATH       — absolute path to the VSCode/Cursor binary
 *   EXTENSION_DEVELOPMENT_PATH   — absolute path to the code/ directory
 *   DATA_DIR                     — absolute path to the repo data/ directory
 *   WORKSPACE_PATH               — absolute path to the SDK workspace folder
 *
 * WHY --user-data-dir IS REQUIRED
 * --------------------------------
 * VSCode and Cursor enforce a per-user single-instance lock keyed on the
 * user-data directory. When a second process starts with the same directory,
 * it detects the running instance, forwards its arguments to it, and exits
 * immediately. Playwright connects to the exited process, finds no windows,
 * and throws:
 *
 *   "electronApplication.firstWindow: Target page, context or browser
 *    has been closed"
 *
 * Passing --user-data-dir pointing to a dedicated test profile directory
 * bypasses the lock. The directory is fixed (not a temp dir) so it persists
 * across runs — VSCode's first-run experience (welcome tabs, telemetry
 * prompts) only occurs once rather than on every test run.
 *
 * The profile directory is e2e/.vscode-test-profile/ (git-ignored).
 * VSCode creates it automatically on first launch; no manual setup needed.
 *
 * HOW THE PANEL OPENS
 * -------------------
 * extension.ts only auto-fires `HisparkAI.show` when detectTargetFromWorkspace()
 * returns 'CPU' or 'NPU'. That function checks for sentinel files inside the
 * opened workspace:
 *
 *   <WORKSPACE_PATH>/build/config/target_config/ws63/ws63.json   → CPU
 *   <WORKSPACE_PATH>/build/config/target_config/3322/3322.json   → NPU
 *
 * WORKSPACE_PATH must point to the real SDK project directory already on disk.
 * It is passed as the positional workspace argument to VSCode at launch, which
 * causes extension.ts to detect the target and call HisparkAI.show automatically.
 *
 * The webview fixture (webview.ts) adds a belt-and-suspenders fallback via the
 * command palette in case the auto-fire races with a slow activation.
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
export const WORKSPACE_PATH = requireEnv('WORKSPACE_PATH');

// Derived data paths — use path.resolve to avoid cross-platform issues.
export const CALI_DIR = path.resolve(DATA_DIR, 'cali');
export const VALI_DIR = path.resolve(DATA_DIR, 'vali');
export const LABEL_CSV = path.resolve(DATA_DIR, 'label.csv');

// Fixed profile directory that persists across runs: e2e/.vscode-test-profile/
// Resolved relative to playwright.config.ts (process.cwd() is the e2e/ dir
// when Playwright runs). VSCode creates the directory on first launch.
// Listed in e2e/.gitignore — never committed.
const USER_DATA_DIR = path.resolve(process.cwd(), '.vscode-test-profile');

type BaseFixtures = {
  app: ElectronApplication;
  electronPage: Page;
};

export const test = base.extend<BaseFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({
      executablePath: VSCODE_EXECUTABLE_PATH,
      args: [
        // Fixed profile dir — bypasses the single-instance lock without
        // creating a new throwaway directory on every run.
        `--user-data-dir=${USER_DATA_DIR}`,
        // Real SDK workspace — its sentinel file makes extension.ts detect
        // 'CPU' or 'NPU' and call HisparkAI.show automatically on activation.
        WORKSPACE_PATH,
        `--extensionDevelopmentPath=${EXTENSION_DEVELOPMENT_PATH}`,
        '--disable-workspace-trust',
        '--no-sandbox',
        '--disable-gpu',
        // Suppress first-run UX that can obstruct the sidebar / panel.
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
