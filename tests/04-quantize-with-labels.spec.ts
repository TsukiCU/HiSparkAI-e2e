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

    // ── 1. Enable Validation toggle ───────────────────────────────────────────
    await test.step('Enable the Validation toggle', async () => {
      const validationToggle = webview
        .locator('[data-testid="validation-toggle"]')
        .locator('button[role="switch"]');

      await validationToggle.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

      const isChecked = await validationToggle.getAttribute('aria-checked');
      if (isChecked === 'false') {
        await validationToggle.click();
      }
      await expect(
        validationToggle,
        'Validation toggle should be on (aria-checked="true") before filling validation inputs'
      ).toHaveAttribute('aria-checked', 'true', { timeout: TIMEOUTS.UI });
    });

    // ── 2. Fill Calibration Inputs path ──────────────────────────────────────
    await test.step('Fill Calibration Inputs path', async () => {
      const calibSection = webview
        .locator('[data-testid="calibration-inputs-section"]');

      const calibPathInput = calibSection.locator('input[type="text"]').first();
      await calibPathInput.fill(CALI_DIR);
      await calibPathInput.press('Tab');
      await expect(
        calibPathInput,
        `Calibration Inputs path field should contain the cali directory path after fill: ${CALI_DIR}`
      ).toHaveValue(CALI_DIR, { timeout: TIMEOUTS.UI });
    });

    // ── 3. Fill Validation Inputs path ────────────────────────────────────────
    await test.step('Fill Validation Inputs path', async () => {
      const validationSection = webview
        .locator('[data-testid="validation-inputs-section"]');

      const validationPathInput = validationSection.locator('input[type="text"]').first();
      await validationPathInput.fill(VALI_DIR);
      await validationPathInput.press('Tab');
      await expect(
        validationPathInput,
        `Validation Inputs path field should contain the vali directory path after fill: ${VALI_DIR}`
      ).toHaveValue(VALI_DIR, { timeout: TIMEOUTS.UI });
    });

    // ── 4. Select a non-None output node from Validation Labels ───────────────
    await test.step('Select a non-None output node from the Validation Labels dropdown', async () => {
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
        labelsSelect.locator('.ant-select-selection-item'),
        'Validation Labels dropdown should show a non-None output node after selection'
      ).not.toHaveText('None', { timeout: TIMEOUTS.UI });
    });

    // ── 5. Fill the labels file path ──────────────────────────────────────────
    // The labels file input appears after a non-None option is selected.
    // It is the file path input to the right of the Validation Labels Select.
    // Locate it by finding the input in the same row-ptq container as the Select.
    await test.step('Fill the Validation Labels file path', async () => {
      const labelsRow = webview.locator('[data-testid="validation-labels-row"]');
      const labelsFileInput = labelsRow.locator('input[type="text"]').last();

      await labelsFileInput.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
      await labelsFileInput.fill(LABEL_CSV);
      await labelsFileInput.press('Tab');
      await expect(
        labelsFileInput,
        `Validation Labels file path field should contain the label.csv path after fill: ${LABEL_CSV}`
      ).toHaveValue(LABEL_CSV, { timeout: TIMEOUTS.UI });
    });

    // ── 6. Click Quantize ─────────────────────────────────────────────────────
    await test.step('Click Quantize button', async () => {
      await webview.locator('[data-testid="quantize-btn"]').click();
    });

    // ── 7. Wait for result row in Quantization Result History ─────────────────
    // ENVIRONMENT PREREQUISITE: backend toolchain must be installed.
    const firstRow = await test.step('Wait for result row in Quantization Result History', async () => {
      const historySection = webview.locator('[data-testid="history-section"]').first();
      const row = historySection.locator('.ant-table-row').first();
      await row.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });
      return row;
    });

    await test.step('Assert most recent result row has a non-empty model name', async () => {
      const modelCell = firstRow.locator('[data-testid="history-row-model-name"]');
      await expect(
        modelCell,
        'Model name cell in the most recent Quantization Result History row should not be empty'
      ).not.toBeEmpty({ timeout: TIMEOUTS.UI });
    });

    // ── 8. Assert Probability Density Histogram canvas is visible ─────────────
    // With labels, histogramCfgData is populated → HistogramGraph renders a canvas.
    await test.step('Assert Probability Density Histogram canvas is visible (labels provided)', async () => {
      const histogramSection = webview.locator('[data-testid="histogram-section"]');
      await expect(
        histogramSection.locator('canvas'),
        'Histogram canvas should be rendered when Validation Labels are selected (Mode 4)'
      ).toBeVisible({ timeout: TIMEOUTS.HISTORY_ROW });
    });
  });
});
