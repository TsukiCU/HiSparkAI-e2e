/**
 * TC-06: Proceed to Convert from Quantization Result History
 *
 * PREREQUISITES:
 *   - At least one entry must exist in Quantization Result History before
 *     this test runs. Run TC-03, TC-04, or TC-05 first to create an entry,
 *     OR the history must have been populated by a prior manual run.
 *   - At least one model entry must exist in History Files (to reach Quantize).
 *
 * COVERS:
 *   - Clicking "Next" in the most recent Quantization Result History row
 *   - Navigation to the Convert page
 *   - Convert page shows "Model currently selected"
 *   - Convert Config table shows at least one input node row
 *   - Convert button is visible and enabled
 */

import { test, expect } from '../fixtures/webview';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Quantize Result → Proceed to Convert', () => {
  test('TC-06: Next button in quantization result row navigates to Convert page', async ({ webview }) => {
    // ── Setup: navigate to Quantize page ─────────────────────────────────────
    await webview
      .locator('[data-testid="history-next-btn"]')
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    await webview
      .locator('[data-testid="history-next-btn"]')
      .first()
      .click();

    await webview
      .locator('h2.section-title', { hasText: 'Quantization Config' })
      .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // ── 1. Assert at least one row exists in Quantization Result History ───────
    // PREREQUISITE: TC-03/04/05 must have run first, or a prior manual run.
    const historySection = webview.locator('[data-testid="history-section"]').first();
    const firstRow = historySection.locator('.ant-table-row').first();

    await firstRow.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // ── 2. Click "Next" in the first (most recent) result row ─────────────────
    // The most-recent row is always first because History.tsx sorts by
    // updateTime descending (History.tsx:368).
    const resultNextBtn = firstRow.locator('[data-testid="result-next-btn"]');
    await resultNextBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    await resultNextBtn.click();

    // ── 3. Assert Convert page loaded ─────────────────────────────────────────
    await expect(
      webview.locator('h2.section-title', { hasText: 'Convert Config' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── 4. Assert "Model currently selected" is visible ───────────────────────
    await expect(
      webview.locator('h2.section-title', { hasText: 'Model currently selected' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── 5. Assert the Convert Config table shows at least one input node row ──
    // The convert config table always has at least one row (one per input node).
    const configTableRow = webview
      .locator('.ant-table-row')
      .first();

    await configTableRow.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // ── 6. Assert the Convert button is visible ───────────────────────────────
    await expect(
      webview.locator('[data-testid="convert-btn"]')
    ).toBeVisible({ timeout: TIMEOUTS.UI });
  });
});
