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

    // ── 1. Enable the Validation toggle ──────────────────────────────────────
    const validationToggle = webview
      .locator('[data-testid="validation-toggle"]')
      .locator('button[role="switch"]');

    await validationToggle.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // Only click if currently off — avoid double-toggling
    const isChecked = await validationToggle.getAttribute('aria-checked');
    if (isChecked === 'false') {
      await validationToggle.click();
    }

    await expect(validationToggle).toHaveAttribute('aria-checked', 'true', { timeout: TIMEOUTS.UI });

    // ── 2. Assert Validation Inputs section is now visible ────────────────────
    await expect(
      webview.locator('.inputs-class-cpu', { hasText: 'Validation Inputs' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── 3. Fill Calibration Inputs path ──────────────────────────────────────
    const calibSection = webview
      .locator('.inputs-class-cpu')
      .filter({ hasText: 'Calibration Inputs' });

    const calibPathInput = calibSection
      .locator('input[type="text"]')
      .first();

    await calibPathInput.fill(CALI_DIR);
    await calibPathInput.press('Tab');
    await expect(calibPathInput).toHaveValue(CALI_DIR, { timeout: TIMEOUTS.UI });

    // ── 4. Fill Validation Inputs path ────────────────────────────────────────
    const validationSection = webview
      .locator('.inputs-class-cpu')
      .filter({ hasText: 'Validation Inputs' });

    const validationPathInput = validationSection
      .locator('input[type="text"]')
      .first();

    await validationPathInput.fill(VALI_DIR);
    await validationPathInput.press('Tab');
    await expect(validationPathInput).toHaveValue(VALI_DIR, { timeout: TIMEOUTS.UI });

    // ── 5. Confirm Validation Labels is "None" (default) ─────────────────────
    // The Select shows the currently selected value. "None" is the default.
    // The validation-labels-select is only visible when the toggle is on.
    const labelsSelect = webview.locator('[data-testid="validation-labels-select"]').first();
    await labelsSelect.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    // Ant Design Select renders the selected value as text inside .ant-select-selection-item
    const labelsValue = labelsSelect.locator('.ant-select-selection-item');
    await expect(labelsValue).toHaveText('None', { timeout: TIMEOUTS.UI });

    // ── 6. Click Quantize ─────────────────────────────────────────────────────
    await webview.locator('[data-testid="quantize-btn"]').click();

    // ── 7. Wait for a result row in Quantization Result History ───────────────
    // ENVIRONMENT PREREQUISITE: backend toolchain must be installed.
    const historySection = webview.locator('[data-testid="history-section"]').first();
    const firstRow = historySection.locator('.ant-table-row').first();

    await firstRow.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });

    // ── 8. Assert model name cell is non-empty ────────────────────────────────
    const modelCell = firstRow.locator('.model-cell__name');
    await expect(modelCell).not.toBeEmpty({ timeout: TIMEOUTS.UI });

    // ── 9. Assert Probability Density Histogram has NO canvas (no labels) ─────
    const histogramSection = webview.locator('[data-testid="histogram-section"]');
    // Without labels, histogramCfgData is empty, so the Empty component renders.
    // The canvas element should NOT be present.
    await expect(
      histogramSection.locator('canvas')
    ).toHaveCount(0, { timeout: TIMEOUTS.UI });
  });
});
