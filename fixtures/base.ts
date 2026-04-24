/**
 * base.ts — Shared Playwright test fixture
 *
 * Launches VSCode (Electron) with the HiSpark Studio AI extension loaded in
 * development mode and exposes the app + main window page to derived fixtures.
 *
 * Required environment variables (set in e2e/.env, see .env.example):
 *   VSCODE_EXECUTABLE_PATH       — absolute path to the VSCode Electron binary
 *   EXTENSION_DEVELOPMENT_PATH   — absolute path to the code/ directory
 *   DATA_DIR                     — absolute path to the repo data/ directory
 *
 * HOW THE PANEL OPENS
 * -------------------
 * extension.ts lines 367-369 only auto-fires `HisparkAI.show` when
 * detectTargetFromWorkspace() returns 'CPU' or 'NPU'.  That function looks for:
 *
 *   <workspaceRoot>/build/config/target_config/ws63/ws63.json   → CPU
 *   <workspaceRoot>/build/config/target_config/3322/3322.json   → NPU
 *
 * Without a workspace containing one of these files, target='NONE' and
 * extension.ts opens the WelcomePage instead of the chip config UI.
 *
 * Fix: createCpuWorkspace() builds a minimal temp directory with the CPU
 * sentinel file and passes it as the positional workspace argument to VSCode.
 * This makes extension.ts detect 'CPU' and call HisparkAI.show automatically
 * during activation — no keyboard or IPC tricks needed.
 *
 * The webview fixture (webview.ts) adds a belt-and-suspenders fallback via
 * the command palette in case the auto-fire races with a slow activation.
 */

import { test as base, expect } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
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

/**
 * Create a minimal temporary workspace that satisfies detectTargetFromWorkspace()
 * in extension.ts so the extension activates in CPU mode.
 *
 * extension.ts:53  const cpuRelPath = path.join('build','config','target_config','ws63','ws63.json');
 * extension.ts:61  if (cpuExist && !npuExist) return 'CPU';
 *
 * The file content is irrelevant — only fs.existsSync is called on it.
 * Returns the workspace root path. Caller is responsible for cleanup.
 */
export function createCpuWorkspace(): string {
  const wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hisparkai-e2e-ws-'));
  const sentinelDir = path.resolve(wsRoot, 'build', 'config', 'target_config', 'ws63');
  fs.mkdirSync(sentinelDir, { recursive: true });
  fs.writeFileSync(path.resolve(sentinelDir, 'ws63.json'), '{}');
  return wsRoot;
}

type BaseFixtures = {
  app: ElectronApplication;
  electronPage: Page;
};

export const test = base.extend<BaseFixtures>({
  app: async ({}, use) => {
    const wsRoot = createCpuWorkspace();

    const app = await electron.launch({
      executablePath: VSCODE_EXECUTABLE_PATH,
      args: [
        // Workspace path as positional arg — makes detectTargetFromWorkspace()
        // return 'CPU', which triggers HisparkAI.show automatically.
        wsRoot,
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

    try { fs.rmSync(wsRoot, { recursive: true, force: true }); } catch { /* ignore */ }
    await app.close();
  },

  electronPage: async ({ app }, use) => {
    const page = await app.firstWindow();
    await use(page);
  },
});

export { expect };
