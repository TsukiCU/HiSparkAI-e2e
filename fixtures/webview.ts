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
 *    NOTE: app-ready is on App (chip config UI) only, not on WelcomePage.
 *    If target='NONE', WelcomePage renders and app-ready never appears.
 *    WelcomePage is detected separately in Step 6 via #project-list.
 * 6. Navigate from Home to Select Model (if needed).
 *    - The Home page (WelcomePage) renders when the extension opens with
 *      target='NONE' (e.g. panel restored from a session where the user
 *      clicked the Home tree item).  It is identified by #project-list.
 *    - If on Home: click the first "Open" link → wait for Select Model.
 *    - If already on Select Model (or later page): skip.
 * 7. Forward WebView console output to the test runner.
 *
 * PREREQUISITE: At least one project must exist in the project list on the
 * Home page, AND at least one model entry must exist in History Files before
 * TC-01 and any test that navigates from Select Model can run. There is no
 * automated seed step — prior manual setup is required.
 */

import { type FrameLocator, type ConsoleMessage } from '@playwright/test';
import { test as baseTest, expect } from './base';

// How long to wait for the outer iframe to appear after issuing the command.
const PANEL_OPEN_TIMEOUT_MS = 15_000;
// How long to wait for VSCode's workbench to be interactive before we start.
const WORKBENCH_READY_TIMEOUT_MS = 20_000;
// Maximum time to wait for the outer iframe before deciding we need to open it.
const IFRAME_POLL_TIMEOUT_MS = 5_000;
// Time to check for app-ready or Home page — whichever comes first.
const APP_READY_TIMEOUT_MS = 20_000;
// Time allowed for clicking Open on a project to land on Select Model.
const NAVIGATE_TO_SELECT_MODEL_MS = 15_000;

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

    // ── Step 5: Wait for the React app to mount ───────────────────────────────
    // Two possible entry states after launch:
    //
    //   A) App (chip config UI): renders when target='CPU'/'NPU'.
    //      Root element has data-testid="app-ready".
    //      Default route is Select Model — no navigation needed.
    //
    //   B) WelcomePage (Home): renders when target='NONE', or when VSCode
    //      restored a session where the user had clicked the Home tree item
    //      (HisparkAI.homeShow forces target='NONE').
    //      Identified by #project-list (stable id, not translated).
    //      Navigation: click "Open" on first project → Select Model.
    //
    // We wait for whichever appears first within the timeout.
    const appReadyLocator  = inner.locator('[data-testid="app-ready"]');
    const homePageLocator  = inner.locator('#project-list');

    // Race: poll both until one is attached.
    let onHomePage = false;
    const deadline = Date.now() + APP_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const appReadyCount = await appReadyLocator.count();
      if (appReadyCount > 0) {
        // App (chip config UI) is mounted — already on Select Model route.
        break;
      }
      const homeCount = await homePageLocator.count();
      if (homeCount > 0) {
        onHomePage = true;
        break;
      }
      // Neither present yet — pause briefly before re-polling.
      await electronPage.waitForTimeout(200);
    }

    // ── Step 6: Navigate from Home to Select Model (if needed) ───────────────
    if (onHomePage) {
      // Wait for the project list table to render at least one row.
      // The Open link in the Operation column has data-testid="project-open-btn"
      // (added to projectList.tsx).  Click the first one to open the project.
      const firstOpenBtn = inner
        .locator('[data-testid="project-open-btn"]')
        .first();

      await firstOpenBtn.waitFor({ state: 'visible', timeout: NAVIGATE_TO_SELECT_MODEL_MS });
      await firstOpenBtn.click();

      // After clicking Open, extension.ts navigates to the chip config panel
      // with the project's target (CPU/NPU).  Wait for app-ready to appear,
      // confirming App has mounted and the Select Model route is active.
      await appReadyLocator.waitFor({ state: 'attached', timeout: NAVIGATE_TO_SELECT_MODEL_MS });
    }

    // At this point App is mounted.  Wait for History Files heading as the
    // final gate confirming Select Model page is fully rendered and ready.
    await inner
      .locator('h2.section-title', { hasText: 'History Files' })
      .waitFor({ state: 'visible', timeout: 15_000 });

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
