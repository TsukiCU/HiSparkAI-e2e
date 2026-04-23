/**
 * TC-05: Quantize — Calibration + Validation + Labels (Mode 4)
 *
 * PREREQUISITES:
 *   - At least one model entry must exist in History Files.
 *   - ENVIRONMENT PREREQUISITE: Backend quantization toolchain must be installed.
 *   - DATA_DIR must contain data/cali/, data/vali/, and data/label.csv.
 *   - The loaded model must have at least one output node (e.g. Plus214_Output_0)
 *     so that the Validation Labels dropdown is non-empty.
 *
 * COVERS:
 *   - Enabling Validation toggle
 *   - Filling Calibration and Validation Inputs paths
 *   - Selecting a non-None output node from Validation Labels dropdown
 *   - Filling the labels file path
 *   - A new row appears in Quantization Result History
 *   - The Probability Density Histogram canvas renders (labels present → histogram)
 */

import * as path from 'path';
import { test, expect } from '../fixtures/webview';
import { CALI_DIR, VALI_DIR, LABEL_CSV } from '../fixtures/base';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Quantize — Calibration + Validation + Labels (Mode 4)', () => {
  test('TC-05: full quantize with labels; histogram renders after success', async ({ webview }) => {
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

    // ── 1. Enable Validation toggle ───────────────────────────────────────────
    const validationToggle = webview
      .locator('[data-testid="validation-toggle"]')
      .locator('button[role="switch"]');

    await validationToggle.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    const isChecked = await validationToggle.getAttribute('aria-checked');
    if (isChecked === 'false') {
      await validationToggle.click();
    }
    await expect(validationToggle).toHaveAttribute('aria-checked', 'true', { timeout: TIMEOUTS.UI });

    // ── 2. Fill Calibration Inputs path ──────────────────────────────────────
    const calibSection = webview
      .locator('.inputs-class-cpu')
      .filter({ hasText: 'Calibration Inputs' });

    const calibPathInput = calibSection.locator('input[type="text"]').first();
    await calibPathInput.fill(CALI_DIR);
    await calibPathInput.press('Tab');
    await expect(calibPathInput).toHaveValue(CALI_DIR, { timeout: TIMEOUTS.UI });

    // ── 3. Fill Validation Inputs path ────────────────────────────────────────
    const validationSection = webview
      .locator('.inputs-class-cpu')
      .filter({ hasText: 'Validation Inputs' });

    const validationPathInput = validationSection.locator('input[type="text"]').first();
    await validationPathInput.fill(VALI_DIR);
    await validationPathInput.press('Tab');
    await expect(validationPathInput).toHaveValue(VALI_DIR, { timeout: TIMEOUTS.UI });

    // ── 4. Select a non-None output node from Validation Labels ───────────────
    const labelsSelect = webview.locator('[data-testid="validation-labels-select"]').first();
    await labelsSelect.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // Open the Ant Design Select dropdown
    await labelsSelect.click();

    // Wait for dropdown options to appear
    const dropdown = webview.locator('.ant-select-dropdown:visible');
    await dropdown.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // Find and click the first non-None option
    const firstNonNoneOption = dropdown
      .locator('.ant-select-item-option')
      .filter({ hasNotText: 'None' })
      .first();

    await firstNonNoneOption.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    const selectedOptionText = await firstNonNoneOption.textContent();
    await firstNonNoneOption.click();

    // Confirm the selection was applied
    await expect(
      labelsSelect.locator('.ant-select-selection-item')
    ).not.toHaveText('None', { timeout: TIMEOUTS.UI });

    // ── 5. Fill the labels file path ──────────────────────────────────────────
    // The labels file input appears after a non-None option is selected.
    // It is the file path input to the right of the Validation Labels Select.
    // Locate it by finding the input in the same row-ptq container as the Select.
    const labelsRow = webview.locator('.row-ptq').filter({ hasText: 'Validation Labels' });
    const labelsFileInput = labelsRow.locator('input[type="text"]').last();

    await labelsFileInput.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    await labelsFileInput.fill(LABEL_CSV);
    await labelsFileInput.press('Tab');
    await expect(labelsFileInput).toHaveValue(LABEL_CSV, { timeout: TIMEOUTS.UI });

    // ── 6. Click Quantize ─────────────────────────────────────────────────────
    await webview.locator('[data-testid="quantize-btn"]').click();

    // ── 7. Wait for result row in Quantization Result History ─────────────────
    // ENVIRONMENT PREREQUISITE: backend toolchain must be installed.
    const historySection = webview.locator('[data-testid="history-section"]').first();
    const firstRow = historySection.locator('.ant-table-row').first();
    await firstRow.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });

    const modelCell = firstRow.locator('.model-cell__name');
    await expect(modelCell).not.toBeEmpty({ timeout: TIMEOUTS.UI });

    // ── 8. Assert Probability Density Histogram canvas is visible ─────────────
    // With labels, histogramCfgData is populated → HistogramGraph renders a canvas.
    const histogramSection = webview.locator('[data-testid="histogram-section"]');
    await expect(
      histogramSection.locator('canvas')
    ).toBeVisible({ timeout: TIMEOUTS.HISTORY_ROW });
  });
});
