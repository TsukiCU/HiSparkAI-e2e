/**
 * webview.ts — WebView frame fixture
 *
 * The HiSpark Studio AI React app lives inside a double-nested iframe:
 *
 *   Electron window (page)
 *     └── <iframe>                        VSCode webview host
 *           └── <iframe#active-frame>     React app
 *
 * PANEL OPEN SEQUENCE
 * -------------------
 * 1. base.ts pre-seeds projectdata.json and spawns VSCode. The extension's
 *    activate() finds isActiveProjectFound=true, keeps target='CPU', and
 *    auto-fires HisparkAI.show — opening the chip config panel directly on
 *    the Select Model page. WelcomePage is never shown.
 * 2. This fixture waits for VSCode's workbench UI to be interactive.
 * 3. If the panel iframe is not yet present (slow machine), the fixture
 *    triggers HisparkAI.show via the command palette as a fallback.
 * 4. Waits for [data-testid="app-ready"] — the React root in App. If this
 *    times out, projectdata.json seeding likely failed (path mismatch).
 * 5. Waits for "History Files" heading to confirm Select Model is rendered.
 * 6. Attaches console and pageerror listeners for test-output observability.
 *
 * PREREQUISITE: At least one model entry must exist in History Files before
 * TC-01 and any test navigating from Select Model can run. There is no
 * automated seed step — a prior manual import is required.
 */

import { type FrameLocator, type ConsoleMessage } from '@playwright/test';
import { test as baseTest, expect } from './base';

const WORKBENCH_READY_TIMEOUT_MS  = 20_000;
const IFRAME_POLL_TIMEOUT_MS      =  5_000;
const PANEL_OPEN_TIMEOUT_MS       = 15_000;
const APP_READY_TIMEOUT_MS        = 20_000;
const SELECT_MODEL_READY_TIMEOUT_MS = 15_000;

type WebviewFixtures = {
  webview: FrameLocator;
};

export const test = baseTest.extend<WebviewFixtures>({
  webview: async ({ electronPage }, use) => {
    // ── Step 1: Wait for VSCode workbench ────────────────────────────────────
    await electronPage.waitForSelector('.monaco-workbench', {
      state: 'visible',
      timeout: WORKBENCH_READY_TIMEOUT_MS,
    });

    // ── Step 2: Check if the panel iframe is already present ─────────────────
    let outerIframePresent = false;
    try {
      await electronPage.waitForSelector('iframe', {
        state: 'attached',
        timeout: IFRAME_POLL_TIMEOUT_MS,
      });
      outerIframePresent = true;
    } catch {
      // Not yet present — will open via command palette.
    }

    // ── Step 3: Open panel via command palette if not already present ─────────
    // HisparkAI.show is registered as "Welcome" in category "HisparkAI", so
    // it appears as "HisparkAI: Welcome" in the command palette.
    if (!outerIframePresent) {
      await electronPage.keyboard.press('Control+Shift+P');
      await electronPage.waitForSelector('.quick-input-widget', {
        state: 'visible',
        timeout: 5_000,
      });
      await electronPage.keyboard.type('HisparkAI: Welcome');
      await electronPage.waitForSelector(
        '.quick-input-list .monaco-list-row:first-child',
        { state: 'visible', timeout: 5_000 }
      );
      await electronPage.keyboard.press('Enter');
      await electronPage.waitForSelector('iframe', {
        state: 'attached',
        timeout: PANEL_OPEN_TIMEOUT_MS,
      });
    }

    // ── Step 4: Resolve the double-nested iframe chain ────────────────────────
    const outer = electronPage.frameLocator('iframe');
    const inner = outer.frameLocator('iframe#active-frame');

    // ── Step 5: Wait for App to mount ────────────────────────────────────────
    // [data-testid="app-ready"] is on the root div of App (chip config UI).
    // It is NOT present on WelcomePage. If this times out, the most likely
    // cause is that projectdata.json was not seeded correctly: check that
    // WORKSPACE_PATH in .env matches what VSCode reports for the workspace
    // (Windows: backslashes, lowercase drive letter).
    await inner
      .locator('[data-testid="app-ready"]')
      .waitFor({ state: 'attached', timeout: APP_READY_TIMEOUT_MS });

    // ── Step 6: Confirm Select Model page is fully rendered ───────────────────
    await inner
      .locator('h2.section-title', { hasText: 'History Files' })
      .waitFor({ state: 'visible', timeout: SELECT_MODEL_READY_TIMEOUT_MS });

    // ── Step 7: Forward WebView console output to the test runner ────────────
    electronPage.on('console', (msg: ConsoleMessage) => {
      console.log(`[webview] ${msg.type()}: ${msg.text()}`);
    });
    electronPage.on('pageerror', (err: Error) => {
      console.log(`[webview] uncaught error: ${err.message}`);
    });

    await use(inner);
  },
});

export { expect };
