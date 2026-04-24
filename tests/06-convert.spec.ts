/**
 * TC-07: Execute Convert
 *
 * PREREQUISITES:
 *   - At least one entry must exist in Quantization Result History so TC-06's
 *     setup step (navigate to Convert via result Next) can run. Run TC-03/04/05
 *     first, or ensure prior history exists.
 *   - ENVIRONMENT PREREQUISITE: The HiSpark backend conversion toolchain must
 *     be installed and accessible. Without it, the script will fail with a
 *     ConvertFailed message notification. This test asserts the success case.
 *
 * COVERS:
 *   - Clicking the Convert button on the Convert page
 *   - A new row appears in Conversion Result History after success
 *   - The most recent row (first, sorted descending) contains a model name
 *   - The Conversion Result bar chart (ConvertStarkGraph canvas) renders
 */

import { test, expect } from '../fixtures/webview';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Convert — Execute Conversion', () => {
  test('TC-07: click Convert button; result row and bar chart appear', async ({ webview }) => {
    // ── Setup: navigate to Quantize, then to Convert via result Next ──────────
    await test.step('Setup: navigate to Quantize page and then to Convert via result Next', async () => {
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

      // Click Next in the most recent quantization result row
      const quantHistorySection = webview.locator('[data-testid="history-section"]').first();
      const firstQuantRow = quantHistorySection.locator('.ant-table-row').first();
      await firstQuantRow.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

      const resultNextBtn = firstQuantRow.locator('[data-testid="result-next-btn"]');
      await resultNextBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
      await resultNextBtn.click();

      // Confirm we're on Convert page
      await webview
        .locator('[data-testid="convert-btn"]')
        .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    });

    // ── 1. Click the Convert button ───────────────────────────────────────────
    await test.step('Click the Convert button', async () => {
      await webview.locator('[data-testid="convert-btn"]').click();
    });

    // ── 2. Wait for a new row in Conversion Result History ────────────────────
    // ENVIRONMENT PREREQUISITE: backend conversion toolchain must be installed.
    // The Conversion Result History section is the second [data-testid="history-section"]
    // on the Convert page (the first is the input node config table, which is not
    // a History component). We locate it by its proximity to "Conversion Result History".
    const firstConvertRow = await test.step('Wait for result row in Conversion Result History', async () => {
      const convertHistoryCard = webview
        .locator('.results-style')
        .locator('[data-testid="history-section"]');

      const row = convertHistoryCard.locator('.ant-table-row').first();
      await row.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });
      return row;
    });

    // ── 3. Assert the most recent row has a non-empty model name ──────────────
    await test.step('Assert most recent Conversion Result History row has a non-empty model name', async () => {
      const modelCell = firstConvertRow.locator('.model-cell__name');
      await expect(
        modelCell,
        'Model name cell in the most recent Conversion Result History row should not be empty'
      ).not.toBeEmpty({ timeout: TIMEOUTS.UI });
    });

    // ── 4. Assert the Conversion Result bar chart canvas renders ─────────────
    // ConvertStarkGraph renders a canvas element when convertCfgDataFirst is populated.
    await test.step('Assert Conversion Result bar chart canvas is visible', async () => {
      const resultPanel = webview.locator('.results-style');
      await expect(
        resultPanel.locator('canvas'),
        'Conversion Result bar chart (canvas element) should be visible after a successful conversion'
      ).toBeVisible({ timeout: TIMEOUTS.HISTORY_ROW });
    });
  });
});
