/**
 * base.ts — Shared Playwright test fixture
 *
 * Launches VSCode / Cursor with the HiSpark Studio AI extension loaded in
 * development mode and exposes the main window page to derived fixtures.
 *
 * Required environment variables (set in e2e/.env, see .env.example):
 *   VSCODE_EXECUTABLE_PATH       — absolute path to the VSCode/Cursor binary
 *   EXTENSION_DEVELOPMENT_PATH   — absolute path to the code/ directory
 *   DATA_DIR                     — absolute path to the repo data/ directory
 *   WORKSPACE_PATH               — absolute path to the SDK workspace folder
 *
 * WHY electron.launch IS NOT USED
 * --------------------------------
 * Playwright's _electron.launch injects --remote-debugging-port=0 into the
 * spawned process's argv and waits to read the assigned port from stdout.
 * VSCode (since ~v1.72) explicitly strips any --remote-debugging-port argument
 * from its own argv during startup because it conflicts with VS Code's built-in
 * extension debugger infrastructure. The stripped flag means Playwright never
 * receives the port advertisement, the CDP connection never establishes, and
 * within ~2 seconds Playwright reports:
 *
 *   "electronApplication.firstWindow: Target page, context or browser
 *    has been closed"
 *
 * This failure is deterministic regardless of timeout — it is not a race
 * condition. Running the same args manually works fine because no CDP
 * injection occurs outside of Playwright.
 *
 * THE FIX: spawn + connectOverCDP
 * --------------------------------
 * We launch VSCode as a plain child process with a fixed
 * --remote-debugging-port=9222 in the args (not injected by Playwright, so
 * VSCode does not strip it). We then poll the CDP endpoint until it responds,
 * connect with chromium.connectOverCDP(), and retrieve the workbench page.
 * This gives a standard Playwright Page object that the webview fixture
 * (webview.ts) consumes without modification.
 *
 * WHY --user-data-dir IS REQUIRED
 * --------------------------------
 * VSCode/Cursor enforce a per-user single-instance lock keyed on the
 * user-data directory. A second process with the same directory detects the
 * running instance, forwards its arguments to it, and exits immediately.
 * The dedicated test profile directory (e2e/.vscode-test-profile/) bypasses
 * this lock. It persists across runs so VSCode's first-run UX only occurs
 * once. Listed in e2e/.gitignore — never committed.
 *
 * HOW THE PANEL OPENS
 * -------------------
 * extension.ts auto-fires HisparkAI.show when detectTargetFromWorkspace()
 * returns 'CPU' or 'NPU'. WORKSPACE_PATH must point to an SDK directory
 * containing the CPU/NPU sentinel file. The webview fixture adds a command-
 * palette fallback in case activation races with a slow launch.
 */

import { test as base, expect, chromium, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as http from 'http';
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
// Resolved relative to the e2e/ directory (process.cwd() when Playwright runs).
// VSCode creates it automatically on first launch. Listed in .gitignore.
const USER_DATA_DIR = path.resolve(process.cwd(), '.vscode-test-profile');

// Fixed CDP port. Must not conflict with other services on the test machine.
// If port 9222 is in use, change this value and restart.
const CDP_PORT = 9222;

// How long to wait for the CDP endpoint to become available after spawn (ms).
// VSCode takes 5-15s to start on a typical Windows machine.
const CDP_READY_TIMEOUT_MS = 60_000;
// Interval between CDP availability polls (ms).
const CDP_POLL_INTERVAL_MS = 500;

/**
 * Poll http://localhost:<port>/json/version until it responds with 200,
 * or until the deadline is exceeded. Resolves when CDP is ready.
 */
function waitForCDP(port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt(): void {
      const req = http.get(
        `http://127.0.0.1:${port}/json/version`,
        (res: http.IncomingMessage) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        }
      );
      req.on('error', retry);
      req.setTimeout(CDP_POLL_INTERVAL_MS, () => { req.destroy(); retry(); });
    }
    function retry(): void {
      if (Date.now() >= deadline) {
        reject(new Error(
          `CDP endpoint http://127.0.0.1:${port}/json/version did not become ` +
          `available within ${timeoutMs}ms. VSCode may have failed to start.`
        ));
        return;
      }
      setTimeout(attempt, CDP_POLL_INTERVAL_MS);
    }
    attempt();
  });
}

// The app fixture exposes a minimal close handle so the webview fixture chain
// compiles. The actual Page is provided by electronPage.
type AppHandle = { close(): Promise<void> };

type BaseFixtures = {
  app: AppHandle;
  electronPage: Page;
};

export const test = base.extend<BaseFixtures>({
  app: async ({}, use) => {
    const vscodeArgs = [
      // Fixed CDP port — VSCode honours this when passed in argv directly
      // (as opposed to Playwright injecting it, which VSCode strips).
      `--remote-debugging-port=${CDP_PORT}`,
      // Fixed profile dir — bypasses the single-instance lock.
      `--user-data-dir=${USER_DATA_DIR}`,
      // Real SDK workspace — sentinel file activates CPU/NPU target.
      WORKSPACE_PATH,
      `--extensionDevelopmentPath=${EXTENSION_DEVELOPMENT_PATH}`,
      '--disable-workspace-trust',
      '--no-sandbox',
      '--disable-gpu',
      '--skip-release-notes',
      '--disable-telemetry',
    ];

    const vscodeProcess: ChildProcess = spawn(
      VSCODE_EXECUTABLE_PATH,
      vscodeArgs,
      {
        // Detach stdio so VSCode's own output doesn't block our process.
        stdio: 'ignore',
        // Do not detach — we want to own the process lifecycle.
        detached: false,
      }
    );

    vscodeProcess.on('error', (err: Error) => {
      throw new Error(`Failed to spawn VSCode: ${err.message}`);
    });

    try {
      await waitForCDP(CDP_PORT, CDP_READY_TIMEOUT_MS);

      const handle: AppHandle = {
        async close() {
          vscodeProcess.kill();
          // Give the process a moment to clean up.
          await new Promise<void>(r => setTimeout(r, 500));
        },
      };

      await use(handle);
    } finally {
      if (!vscodeProcess.killed) {
        vscodeProcess.kill();
      }
    }
  },

  electronPage: async ({ app: _app }: { app: AppHandle }, use: (p: Page) => Promise<void>) => {
    // Connect to the VSCode workbench via CDP.
    // connectOverCDP returns a Browser object; we take the first context's
    // first page, which is the VSCode workbench window.
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

    try {
      // VSCode may have multiple browser contexts (background workers, etc.).
      // The workbench window is always the first page in the default context.
      const contexts = browser.contexts();
      if (contexts.length === 0) {
        throw new Error('No browser contexts found after CDP connection.');
      }

      // Wait for a page to appear if none exist yet.
      let page = contexts[0].pages()[0];
      if (!page) {
        page = await contexts[0].waitForEvent('page', { timeout: 30_000 });
      }

      await use(page);
    } finally {
      await browser.close();
    }
  },
});

export { expect };
