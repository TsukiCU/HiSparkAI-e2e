/**
 * TC-03: Quantize — Calibration Only (Mode 2)
 *
 * PREREQUISITES:
 *   - At least one model entry must exist in History Files.
 *   - ENVIRONMENT PREREQUISITE: The HiSpark backend quantization toolchain
 *     must be installed and accessible. Without it, the backend script will
 *     fail and a vscode.window.showErrorMessage notification will appear
 *     instead of a new history row. This test asserts the success case.
 *   - DATA_DIR env var must point to the repo data/ directory containing
 *     data/cali/ (calibration .npy files).
 *
 * COVERS:
 *   - Filling the Calibration Inputs path and clicking Quantize
 *   - Validation toggle remains OFF (default state)
 *   - A new row appears in Quantization Result History after success
 *   - The most recent row (first in descending order) contains the model name
 */

import * as path from 'path';
import { test, expect } from '../fixtures/webview';
import { CALI_DIR } from '../fixtures/base';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Quantize — Calibration Only (Mode 2)', () => {
  test('TC-03: fill calibration path and quantize; new result row appears', async ({ webview }) => {
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

    // ── 1. Assert Validation toggle is OFF (default) ──────────────────────────
    // The toggle container is data-testid="validation-toggle"; the Ant Switch
    // within it has role="switch" and aria-checked="false" when off.
    await test.step('Assert Validation toggle is OFF (default state)', async () => {
      const validationToggle = webview
        .locator('[data-testid="validation-toggle"]')
        .locator('button[role="switch"]');

      await validationToggle.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
      await expect(
        validationToggle,
        'Validation toggle should be off (aria-checked="false") by default before the test fills any inputs'
      ).toHaveAttribute('aria-checked', 'false');
    });

    // ── 2. Fill the Calibration Inputs path ───────────────────────────────────
    // The Calibration Inputs section contains one row per model input node.
    // We target the first path input under the "Calibration Inputs" heading.
    await test.step('Fill Calibration Inputs path', async () => {
      const calibSection = webview
        .locator('.inputs-class-cpu')
        .filter({ hasText: 'Calibration Inputs' });

      const calibPathInput = calibSection
        .locator('input[type="text"]')
        .first();

      await calibPathInput.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
      await calibPathInput.fill(CALI_DIR);
      await calibPathInput.press('Tab');

      // Verify the value was committed into the input
      await expect(
        calibPathInput,
        `Calibration Inputs path field should contain the cali directory path after fill: ${CALI_DIR}`
      ).toHaveValue(CALI_DIR, { timeout: TIMEOUTS.UI });
    });

    // ── 3. Click Quantize ─────────────────────────────────────────────────────
    await test.step('Click Quantize button', async () => {
      await webview.locator('[data-testid="quantize-btn"]').click();
    });

    // ── 4. Wait for a result row in Quantization Result History ───────────────
    // ENVIRONMENT PREREQUISITE: backend toolchain must be installed.
    // If this times out, check that the toolchain is available and the model
    // file is valid. The timeout is generous (180s) for slow machines.
    const firstRow = await test.step('Wait for result row in Quantization Result History', async () => {
      const historySection = webview.locator('[data-testid="history-section"]').first();
      const row = historySection.locator('.ant-table-row').first();
      await row.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });
      return row;
    });

    // ── 5. Assert the most recent row contains the model name ─────────────────
    // The model name column displays the filename. We assert it's non-empty.
    await test.step('Assert most recent result row has a non-empty model name', async () => {
      const modelCell = firstRow.locator('.model-cell__name');
      await expect(
        modelCell,
        'Model name cell in the most recent Quantization Result History row should not be empty'
      ).not.toBeEmpty({ timeout: TIMEOUTS.UI });
    });
  });
});
