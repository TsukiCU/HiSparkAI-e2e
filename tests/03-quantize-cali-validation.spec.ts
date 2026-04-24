/**
 * TC-04: Quantize — Calibration + Validation, No Labels (Mode 3)
 *
 * PREREQUISITES:
 *   - At least one model entry must exist in History Files.
 *   - ENVIRONMENT PREREQUISITE: Backend quantization toolchain must be installed.
 *   - DATA_DIR must contain data/cali/ and data/vali/.
 *
 * COVERS:
 *   - Enabling the Validation toggle reveals the Validation Inputs section
 *   - Filling both Calibration and Validation Inputs paths
 *   - Leaving Validation Labels as "None"
 *   - A new row appears in Quantization Result History after success
 *   - The Probability Density Histogram does NOT render (no labels = no histogram)
 */

import * as path from 'path';
import { test, expect } from '../fixtures/webview';
import { CALI_DIR, VALI_DIR } from '../fixtures/base';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Quantize — Calibration + Validation, No Labels (Mode 3)', () => {
  test('TC-04: enable validation toggle, fill both paths, quantize; result row appears', async ({ webview }) => {
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
        .locator('[data-testid="quantize-btn"]')
        .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    });

    // ── 1. Enable the Validation toggle ──────────────────────────────────────
    await test.step('Enable the Validation toggle', async () => {
      const validationToggle = webview
        .locator('[data-testid="validation-toggle"]')
        .locator('button[role="switch"]');

      await validationToggle.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

      // Only click if currently off — avoid double-toggling
      const isChecked = await validationToggle.getAttribute('aria-checked');
      if (isChecked === 'false') {
        await validationToggle.click();
      }

      await expect(
        validationToggle,
        'Validation toggle should be on (aria-checked="true") after clicking it'
      ).toHaveAttribute('aria-checked', 'true', { timeout: TIMEOUTS.UI });
    });

    // ── 2. Assert Validation Inputs section is now visible ────────────────────
    await test.step('Assert Validation Inputs section is visible after toggle is enabled', async () => {
      await expect(
        webview.locator('[data-testid="validation-inputs-section"]'),
        'Validation Inputs section should appear in the DOM when the Validation toggle is on'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 3. Fill Calibration Inputs path ──────────────────────────────────────
    await test.step('Fill Calibration Inputs path', async () => {
      const calibSection = webview
        .locator('[data-testid="calibration-inputs-section"]');

      const calibPathInput = calibSection
        .locator('input[type="text"]')
        .first();

      await calibPathInput.fill(CALI_DIR);
      await calibPathInput.press('Tab');
      await expect(
        calibPathInput,
        `Calibration Inputs path field should contain the cali directory path after fill: ${CALI_DIR}`
      ).toHaveValue(CALI_DIR, { timeout: TIMEOUTS.UI });
    });

    // ── 4. Fill Validation Inputs path ────────────────────────────────────────
    await test.step('Fill Validation Inputs path', async () => {
      const validationSection = webview
        .locator('[data-testid="validation-inputs-section"]');

      const validationPathInput = validationSection
        .locator('input[type="text"]')
        .first();

      await validationPathInput.fill(VALI_DIR);
      await validationPathInput.press('Tab');
      await expect(
        validationPathInput,
        `Validation Inputs path field should contain the vali directory path after fill: ${VALI_DIR}`
      ).toHaveValue(VALI_DIR, { timeout: TIMEOUTS.UI });
    });

    // ── 5. Confirm Validation Labels is "None" (default) ─────────────────────
    // The Select shows the currently selected value. "None" is the default.
    // The validation-labels-select is only visible when the toggle is on.
    await test.step('Confirm Validation Labels dropdown is set to "None" (default)', async () => {
      const labelsSelect = webview.locator('[data-testid="validation-labels-select"]').first();
      await labelsSelect.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
      // Ant Design Select renders the selected value as text inside .ant-select-selection-item
      const labelsValue = labelsSelect.locator('.ant-select-selection-item');
      await expect(
        labelsValue,
        'Validation Labels dropdown should show "None" by default (no labels = Mode 3)'
      ).toHaveText('None', { timeout: TIMEOUTS.UI });
    });

    // ── 6. Click Quantize ─────────────────────────────────────────────────────
    await test.step('Click Quantize button', async () => {
      await webview.locator('[data-testid="quantize-btn"]').click();
    });

    // ── 7. Wait for a result row in Quantization Result History ───────────────
    // ENVIRONMENT PREREQUISITE: backend toolchain must be installed.
    const firstRow = await test.step('Wait for result row in Quantization Result History', async () => {
      const historySection = webview.locator('[data-testid="history-section"]').first();
      const row = historySection.locator('.ant-table-row').first();
      await row.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });
      return row;
    });

    // ── 8. Assert model name cell is non-empty ────────────────────────────────
    await test.step('Assert most recent result row has a non-empty model name', async () => {
      const modelCell = firstRow.locator('[data-testid="history-row-model-name"]');
      await expect(
        modelCell,
        'Model name cell in the most recent Quantization Result History row should not be empty'
      ).not.toBeEmpty({ timeout: TIMEOUTS.UI });
    });

    // ── 9. Assert Probability Density Histogram has NO canvas (no labels) ─────
    await test.step('Assert Probability Density Histogram has no canvas (no labels provided)', async () => {
      const histogramSection = webview.locator('[data-testid="histogram-section"]');
      // Without labels, histogramCfgData is empty, so the Empty component renders.
      // The canvas element should NOT be present.
      await expect(
        histogramSection.locator('canvas'),
        'Histogram canvas should not be rendered when no Validation Labels are selected (Mode 3)'
      ).toHaveCount(0, { timeout: TIMEOUTS.UI });
    });
  });
});
