/**
 * TC-08: Full Pipeline Smoke Test — Home → Select Model → Skip Quantize → Convert
 *
 * PREREQUISITES:
 *   - At least one model entry must exist in History Files.
 *   - ENVIRONMENT PREREQUISITE: Backend conversion toolchain must be installed.
 *     This test exercises the fastest fully-automated pipeline path:
 *     Select Model (from history) → Next Without Quantization → Convert.
 *
 * COVERS:
 *   - Complete path from Select Model to Convert result in one test
 *   - TC-01 (model selection from history)
 *   - TC-02 (skip quantization)
 *   - TC-07 (execute convert)
 *   - All three assertions: model name on Quantize, Convert page loads, result row appears
 *
 * This is the fast smoke test — it uses the skip-quantize path (Mode 1) to
 * avoid the backend quantization toolchain dependency. Only the conversion
 * toolchain is required.
 */

import { test, expect } from '../fixtures/webview';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Full Pipeline Smoke Test', () => {
  test('TC-08: Select Model → Skip Quantize → Convert → result row appears', async ({ webview }) => {
    // ── Step 1: Select model from History Files (TC-01) ───────────────────────
    const modelFilename = await test.step('Select model from History Files', async () => {
      await webview
        .locator('[data-testid="history-next-btn"]')
        .first()
        .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

      // Capture the model filename for later assertion
      const modelNameEl = webview.locator('.config-card .sub-title span').first();
      const modelNameText = await modelNameEl.textContent({ timeout: TIMEOUTS.UI });
      const filename = modelNameText?.split(' (')[0]?.trim() ?? '';
      expect(filename, 'Model filename extracted from history entry should be non-empty').toBeTruthy();

      await webview.locator('[data-testid="history-next-btn"]').first().click();

      // Confirm navigation to Quantize
      await expect(
        webview.locator('h2.section-title', { hasText: 'Model currently selected' }),
        '"Model currently selected" heading should appear on the Quantize page after clicking Next'
      ).toBeVisible({ timeout: TIMEOUTS.UI });

      // Confirm the model name carried through
      await expect(
        webview.locator('.model-selected span', { hasText: filename }),
        `Model filename "${filename}" should be displayed in the model-selected area on Quantize`
      ).toBeVisible({ timeout: TIMEOUTS.UI });

      return filename;
    });

    // ── Step 2: Skip Quantization (TC-02) ─────────────────────────────────────
    await test.step('Skip Quantization via "Next Without Quantization" button', async () => {
      await webview
        .locator('[data-testid="skip-quantization-btn"]')
        .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

      await webview.locator('[data-testid="skip-quantization-btn"]').click();

      // Confirm we reached the Convert page
      await expect(
        webview.locator('h2.section-title', { hasText: 'Convert Config' }),
        '"Convert Config" heading should be visible after skipping quantization'
      ).toBeVisible({ timeout: TIMEOUTS.UI });

      await expect(
        webview.locator('h2.section-title', { hasText: 'Model currently selected' }),
        '"Model currently selected" heading should be visible on the Convert page'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── Step 3: Execute Convert (TC-07) ───────────────────────────────────────
    await test.step('Execute Convert', async () => {
      await webview
        .locator('[data-testid="convert-btn"]')
        .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

      await webview.locator('[data-testid="convert-btn"]').click();
    });

    // ── Step 4: Assert result row appears in Conversion Result History ─────────
    // ENVIRONMENT PREREQUISITE: backend conversion toolchain must be installed.
    const firstConvertRow = await test.step('Wait for result row in Conversion Result History', async () => {
      const convertHistoryCard = webview
        .locator('.results-style')
        .locator('[data-testid="history-section"]');

      const row = convertHistoryCard.locator('.ant-table-row').first();
      await row.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });
      return row;
    });

    await test.step('Assert most recent Conversion Result History row has a non-empty model name', async () => {
      const modelCell = firstConvertRow.locator('.model-cell__name');
      await expect(
        modelCell,
        'Model name cell in the most recent Conversion Result History row should not be empty'
      ).not.toBeEmpty({ timeout: TIMEOUTS.UI });
    });

    // ── Step 5: Assert Conversion Result bar chart renders ────────────────────
    await test.step('Assert Conversion Result bar chart canvas is visible', async () => {
      const resultPanel = webview.locator('.results-style');
      await expect(
        resultPanel.locator('canvas'),
        'Conversion Result bar chart (canvas element) should be visible after a successful conversion'
      ).toBeVisible({ timeout: TIMEOUTS.HISTORY_ROW });
    });
  });
});
