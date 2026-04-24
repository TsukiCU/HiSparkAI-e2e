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
 * 1. base.ts passes a CPU workspace to VSCode so extension.ts detects 'CPU'
 *    and calls HisparkAI.show automatically during activation.
 * 2. This fixture waits for VSCode's workbench UI to be interactive, then
 *    checks whether the outer webview iframe is already present.
 * 3. If the iframe is NOT yet present (activation race or slow machine), the
 *    fixture triggers HisparkAI.show via the command palette (Ctrl+Shift+P →
 *    type "HisparkAI: Welcome" → Enter).  This is the registered title of the
 *    'HisparkAI.show' command (package.json contributes.commands).
 * 4. If the iframe IS already present (panel restored from a prior session, or
 *    activation completed before we checked), no command is issued — the
 *    fixture proceeds directly to readiness checks.
 * 5. Wait for [data-testid="app-ready"] inside the inner iframe.
 * 6. Defensive check: confirm .ant-steps (pipeline navbar) is visible,
 *    proving App rendered rather than WelcomePage.
 *
 * PREREQUISITE: At least one model entry must exist in History Files before
 * TC-01 and any test that navigates from Select Model can run. There is no
 * automated seed step — a prior manual import is required.
 */

import { type FrameLocator, type ConsoleMessage } from '@playwright/test';
import { test as baseTest, expect } from './base';

// How long to wait for the outer iframe to appear after issuing the command.
const PANEL_OPEN_TIMEOUT_MS = 15_000;
// How long to wait for VSCode's workbench to be interactive before we start.
const WORKBENCH_READY_TIMEOUT_MS = 20_000;
// Maximum time to wait for the outer iframe before deciding we need to open it.
const IFRAME_POLL_TIMEOUT_MS = 5_000;

type WebviewFixtures = {
  webview: FrameLocator;
};

export const test = baseTest.extend<WebviewFixtures>({
  webview: async ({ electronPage }, use) => {
    // ── Step 1: Wait for VSCode's workbench to be interactive ────────────────
    // The workbench shell renders a .monaco-workbench element.  Waiting for it
    // confirms VSCode has finished loading its UI and the extension host is
    // running (extension activation happens synchronously with workbench ready).
    await electronPage.waitForSelector('.monaco-workbench', {
      state: 'visible',
      timeout: WORKBENCH_READY_TIMEOUT_MS,
    });

    // ── Step 2: Check if the outer WebView iframe is already present ──────────
    // The outer iframe appears as soon as ChipConfigPanel.toggle() calls
    // panel.reveal().  We give the auto-open a short window to complete before
    // deciding whether to issue the command ourselves.
    let outerIframePresent = false;
    try {
      await electronPage.waitForSelector('iframe', {
        state: 'attached',
        timeout: IFRAME_POLL_TIMEOUT_MS,
      });
      outerIframePresent = true;
    } catch {
      // Iframe did not appear within the poll window — we will open the panel.
    }

    // ── Step 3: Open the panel if it is not already present ──────────────────
    // Trigger HisparkAI.show via the command palette.
    // The registered title for command 'HisparkAI.show' is "Welcome" with
    // category "HisparkAI", so it appears as "HisparkAI: Welcome" in the
    // palette (VSCode formats category + title).
    if (!outerIframePresent) {
      // Open the command palette.  Ctrl+Shift+P works headlessly in Electron.
      await electronPage.keyboard.press('Control+Shift+P');

      // Wait for the quick-input widget (command palette input box) to appear.
      await electronPage.waitForSelector('.quick-input-widget', {
        state: 'visible',
        timeout: 5_000,
      });

      // Type the command title.  VSCode fuzzy-matches from the first few chars.
      await electronPage.keyboard.type('HisparkAI: Welcome');

      // Wait briefly for the fuzzy match list to populate.
      await electronPage.waitForSelector(
        '.quick-input-list .monaco-list-row:first-child',
        { state: 'visible', timeout: 5_000 }
      );

      // Accept the first result.
      await electronPage.keyboard.press('Enter');

      // Wait for the outer iframe to appear now that the panel is opening.
      await electronPage.waitForSelector('iframe', {
        state: 'attached',
        timeout: PANEL_OPEN_TIMEOUT_MS,
      });
    }

    // ── Step 4: Resolve the double-nested iframe chain ────────────────────────
    // Layer 1: VSCode's webview host container (first iframe in the window).
    const outer = electronPage.frameLocator('iframe');
    // Layer 2: the React app frame (iframe#active-frame inside the host).
    const inner = outer.frameLocator('iframe#active-frame');

    // ── Step 5: Wait for [data-testid="app-ready"] ────────────────────────────
    // This attribute is on the root <div> in app.tsx and appears the moment
    // React mounts — before any async data load — making it a reliable gate.
    await inner
      .locator('[data-testid="app-ready"]')
      .waitFor({ state: 'attached', timeout: 20_000 });

    // ── Step 6: Defensive check — App rendered, not WelcomePage ──────────────
    // .ant-steps (the pipeline navbar) only exists in App, not in WelcomePage.
    // If this times out the workspace sentinel (base.ts) did not produce
    // target='CPU', causing extension.ts to render WelcomePage instead.
    // Check that the workspace contains the CPU sentinel file.
    await inner
      .locator('.ant-steps')
      .waitFor({ state: 'visible', timeout: 10_000 });

    // ── Step 7: Forward WebView console output to the test runner ────────────
    // Playwright captures Page console events from the Electron window.
    // Messages originating inside the double-nested iframe bubble up as page
    // console events, so this single listener covers React errors, unhandled
    // promise rejections, and any console.log calls made in the frontend.
    // The listener is attached per-fixture scope, so it only appears in the
    // output for the currently running test.
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
