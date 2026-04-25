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
 * VSCode (since ~v1.72) explicitly strips --remote-debugging-port from its
 * own argv during startup because it conflicts with VS Code's built-in
 * extension debugger infrastructure. The stripped flag means Playwright never
 * receives the port advertisement, the CDP connection never establishes, and
 * within ~2 seconds Playwright reports:
 *
 *   "electronApplication.firstWindow: Target page, context or browser
 *    has been closed"
 *
 * This failure is deterministic regardless of timeout — it is not a race.
 * Running the same args manually works fine because no CDP injection occurs
 * outside of Playwright.
 *
 * THE FIX: spawn + connectOverCDP
 * --------------------------------
 * We launch VSCode as a plain child process with --remote-debugging-port=9222
 * (not injected by Playwright, so VSCode does not strip it). We poll the CDP
 * endpoint until it responds, connect with chromium.connectOverCDP(), and
 * retrieve the workbench page — a standard Playwright Page the webview fixture
 * consumes without modification.
 *
 * WHY --user-data-dir IS REQUIRED
 * --------------------------------
 * VSCode/Cursor enforce a per-user single-instance lock keyed on the
 * user-data directory. A second process with the same directory detects the
 * running instance, forwards its arguments to it, and exits immediately.
 * e2e/.vscode-test-profile/ bypasses this lock and persists across runs so
 * VSCode's first-run UX only occurs once. Listed in .gitignore.
 *
 * WHY projectdata.json IS PRE-SEEDED
 * ------------------------------------
 * extension.ts activate() does the following after detectTargetFromWorkspace():
 *
 *   const storageDir = path.dirname(context.globalStorageUri.fsPath);
 *   const cachePath  = path.join(storageDir, 'projectdata.json');
 *   for (const item of JSON.parse(fs.readFileSync(cachePath))) {
 *     if (item.SDK === workspaceFolderPath && item.active) {
 *       isActiveProjectFound = true; break;
 *     }
 *   }
 *   if (!isActiveProjectFound) target = 'NONE'; // → WelcomePage, no panel
 *
 * With a fresh .vscode-test-profile/ this file does not exist, so target is
 * always forced to 'NONE' and the chip config panel never opens.
 *
 * Fix: write projectdata.json into the profile before spawning VSCode.
 *
 * PATH NORMALISATION
 * -------------------
 * VSCode's workspace.workspaceFolders[0].uri.fsPath on Windows produces
 * backslash paths with a LOWERCASE drive letter (e.g. d:\tsuki\SDK\ws63),
 * regardless of how the path was originally passed. WORKSPACE_PATH in .env
 * may use uppercase (D:\...). We normalise to lowercase drive letter and
 * backslashes on Windows so item.SDK matches workspaceFolderPath exactly.
 *
 * The `active` field is the path to the active .hiproj file. The extension
 * only checks that it is truthy (stores it via GlobalModel.instance.hiprojPath
 * for later use), so any non-empty string works as a seed value.
 */

import { test as base, expect, chromium, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
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

// Fixed profile directory. Persists across runs; git-ignored.
const USER_DATA_DIR = path.resolve(process.cwd(), '.vscode-test-profile');

// CDP port. Change if 9222 is already in use on the test machine.
const CDP_PORT = 9222;

// How long to wait for CDP to become available after spawn.
const CDP_READY_TIMEOUT_MS = 60_000;
const CDP_POLL_INTERVAL_MS = 500;

/**
 * Normalise a workspace path so it matches what VSCode reports via
 * workspace.workspaceFolders[0].uri.fsPath on each platform:
 *
 *   Windows: backslashes, lowercase drive letter  (d:\tsuki\sdk\ws63)
 *   macOS / Linux: forward slashes as-is
 */
function normaliseWorkspacePath(p: string): string {
  if (process.platform === 'win32') {
    // Convert forward slashes to backslashes, then lowercase the drive letter.
    const backslashed = p.replace(/\//g, '\\');
    return backslashed.replace(/^[A-Z]:\\/, (m) => m.toLowerCase());
  }
  return p;
}

/**
 * Write <USER_DATA_DIR>/User/globalStorage/projectdata.json so that
 * extension.ts activate() finds isActiveProjectFound = true for WORKSPACE_PATH.
 *
 * The directory is created if it does not exist (it may not exist on the very
 * first run before VSCode has initialised the profile).
 *
 * If the file already contains an entry for this workspace, it is left as-is
 * to avoid disrupting user data that VSCode may have updated.
 */
function seedProjectData(): void {
  // The extension reads from path.dirname(context.globalStorageUri.fsPath).
  // globalStorageUri.fsPath = <USER_DATA_DIR>/User/globalStorage/<extensionId>/
  // so dirname = <USER_DATA_DIR>/User/globalStorage/
  const globalStorageDir = path.join(USER_DATA_DIR, 'User', 'globalStorage');
  const projectDataPath  = path.join(globalStorageDir, 'projectdata.json');
  const normalisedWorkspace = normaliseWorkspacePath(WORKSPACE_PATH);

  // Read existing data if the file is already present.
  let entries: Array<Record<string, unknown>> = [];
  if (fs.existsSync(projectDataPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(projectDataPath, 'utf-8'));
      if (Array.isArray(parsed)) {
        entries = parsed;
      }
    } catch {
      // Corrupt file — start fresh.
    }

    // If an entry for this workspace already exists, nothing to do.
    const alreadySeeded = entries.some(
      (item) => item['SDK'] === normalisedWorkspace && item['active']
    );
    if (alreadySeeded) return;
  }

  // Create the directory if needed (first run before VSCode has ever opened).
  fs.mkdirSync(globalStorageDir, { recursive: true });

  // Append a minimal entry. `active` just needs to be a non-empty string —
  // extension.ts only checks truthiness and stores it in GlobalModel.
  entries.push({
    SDK: normalisedWorkspace,
    active: path.join(normalisedWorkspace, 'hisparkai.hiproj'),
  });

  fs.writeFileSync(projectDataPath, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * Poll the CDP /json/version endpoint until it responds with 200,
 * or until the deadline is exceeded.
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

type AppHandle = { close(): Promise<void> };

type BaseFixtures = {
  app: AppHandle;
  electronPage: Page;
};

export const test = base.extend<BaseFixtures>({
  app: async ({}, use) => {
    // Pre-seed projectdata.json so extension.ts finds isActiveProjectFound=true
    // and keeps target='CPU' instead of overriding it to 'NONE'.
    seedProjectData();

    const vscodeProcess: ChildProcess = spawn(
      VSCODE_EXECUTABLE_PATH,
      [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${USER_DATA_DIR}`,
        WORKSPACE_PATH,
        `--extensionDevelopmentPath=${EXTENSION_DEVELOPMENT_PATH}`,
        '--disable-workspace-trust',
        '--no-sandbox',
        '--disable-gpu',
        '--skip-release-notes',
        '--disable-telemetry',
      ],
      { stdio: 'ignore', detached: false }
    );

    vscodeProcess.on('error', (err: Error) => {
      throw new Error(`Failed to spawn VSCode: ${err.message}`);
    });

    try {
      await waitForCDP(CDP_PORT, CDP_READY_TIMEOUT_MS);

      const handle: AppHandle = {
        async close() {
          vscodeProcess.kill();
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
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

    try {
      const contexts = browser.contexts();
      if (contexts.length === 0) {
        throw new Error('No browser contexts found after CDP connection.');
      }

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
