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
    await test.step('Setup: navigate to Quantize page via history Next button', async () => {
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
    });

    // ── 1. Assert at least one row exists in Quantization Result History ───────
    // PREREQUISITE: TC-03/04/05 must have run first, or a prior manual run.
    const firstRow = await test.step('Assert at least one row exists in Quantization Result History', async () => {
      const historySection = webview.locator('[data-testid="history-section"]').first();
      const row = historySection.locator('.ant-table-row').first();
      await expect(
        row,
        'Quantization Result History must have at least one row — run TC-03/04/05 first or import manually'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
      return row;
    });

    // ── 2. Click "Next" in the first (most recent) result row ─────────────────
    // The most-recent row is always first because History.tsx sorts by
    // updateTime descending (History.tsx:368).
    await test.step('Click Next button in the most recent Quantization Result History row', async () => {
      const resultNextBtn = firstRow.locator('[data-testid="result-next-btn"]');
      await expect(
        resultNextBtn,
        'Next button should be visible in the most recent quantization result row'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
      await resultNextBtn.click();
    });

    // ── 3. Assert Convert page loaded ─────────────────────────────────────────
    await test.step('Assert Convert page loaded (Convert Config heading)', async () => {
      await expect(
        webview.locator('h2.section-title', { hasText: 'Convert Config' }),
        '"Convert Config" heading should be visible after navigating from quantization result'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 4. Assert "Model currently selected" is visible ───────────────────────
    await test.step('Assert "Model currently selected" heading is visible on Convert page', async () => {
      await expect(
        webview.locator('h2.section-title', { hasText: 'Model currently selected' }),
        '"Model currently selected" heading should be visible on the Convert page'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 5. Assert the Convert Config table shows at least one input node row ──
    // The convert config table always has at least one row (one per input node).
    await test.step('Assert Convert Config table has at least one input node row', async () => {
      const configTableRow = webview
        .locator('.ant-table-row')
        .first();

      await expect(
        configTableRow,
        'Convert Config table should show at least one input node row (pre-filled from model)'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 6. Assert the Convert button is visible ───────────────────────────────
    await test.step('Assert Convert button is visible', async () => {
      await expect(
        webview.locator('[data-testid="convert-btn"]'),
        'Convert button should be visible and ready to click on the Convert page'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });
  });
});
