/**
 * webview.ts — WebView frame fixture
 *
 * The HiSpark Studio AI React app lives inside a double-nested iframe:
 *
 *   Electron window (page)
 *     └── <iframe>                        VSCode webview host
 *           └── <iframe#active-frame>     React app
 *
 * This fixture resolves and caches the inner FrameLocator, waiting for:
 *   1. [data-testid="app-ready"]   — React root has mounted (added to app.tsx)
 *   2. The pipeline navbar          — confirms App (not WelcomePage) rendered,
 *                                     catching the initialState injection race
 *                                     described in the risk register §7.
 *
 * PREREQUISITE: The extension panel must already be open (triggered by
 * clicking the HiSpark sidebar icon or via a VSCode command) before this
 * fixture can resolve the iframe. Tests that need to open the panel first
 * should do so using the `openPanel` helper from helpers/wait.ts.
 *
 * PREREQUISITE: At least one model entry must exist in History Files before
 * TC-01 and any test that navigates from Select Model can run. There is no
 * automated seed step — a prior manual import is required.
 */

import { FrameLocator } from 'playwright';
import { test as baseTest, expect } from './base';

type WebviewFixtures = {
  webview: FrameLocator;
};

export const test = baseTest.extend<WebviewFixtures>({
  webview: async ({ electronPage }, use) => {
    // Step 1: Resolve the outer iframe (VSCode's webview host container).
    const outer = electronPage.frameLocator('iframe');

    // Step 2: Resolve the inner iframe where the React app lives.
    const inner = outer.frameLocator('iframe#active-frame');

    // Step 3: Wait for the app-ready sentinel added to app.tsx.
    // Timeout is generous because extension activation is async.
    await inner
      .locator('[data-testid="app-ready"]')
      .waitFor({ state: 'attached', timeout: 20_000 });

    // Step 4: Defensive check — confirm App rendered, not WelcomePage.
    // The Ant Design Steps navbar (.ant-steps) is only present in App, not
    // in WelcomePage. If this times out, the initialState injection race
    // described in the risk register §7 has occurred.
    await inner
      .locator('.ant-steps')
      .waitFor({ state: 'visible', timeout: 10_000 });

    await use(inner);
  },
});

export { expect };
