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

    // ── 1. Assert Validation toggle is OFF (default) ──────────────────────────
    // The toggle container is data-testid="validation-toggle"; the Ant Switch
    // within it has role="switch" and aria-checked="false" when off.
    const validationToggle = webview
      .locator('[data-testid="validation-toggle"]')
      .locator('button[role="switch"]');

    await validationToggle.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
    await expect(validationToggle).toHaveAttribute('aria-checked', 'false');

    // ── 2. Fill the Calibration Inputs path ───────────────────────────────────
    // The Calibration Inputs section contains one row per model input node.
    // We target the first path input under the "Calibration Inputs" heading.
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
    await expect(calibPathInput).toHaveValue(CALI_DIR, { timeout: TIMEOUTS.UI });

    // ── 3. Click Quantize ─────────────────────────────────────────────────────
    await webview.locator('[data-testid="quantize-btn"]').click();

    // ── 4. Wait for a result row in Quantization Result History ───────────────
    // ENVIRONMENT PREREQUISITE: backend toolchain must be installed.
    // If this times out, check that the toolchain is available and the model
    // file is valid. The timeout is generous (180s) for slow machines.
    const historySection = webview.locator('[data-testid="history-section"]').first();
    const firstRow = historySection.locator('.ant-table-row').first();

    await firstRow.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });

    // ── 5. Assert the most recent row contains the model name ─────────────────
    // The model name column displays the filename. We assert it's non-empty.
    const modelCell = firstRow.locator('.model-cell__name');
    await expect(modelCell).not.toBeEmpty({ timeout: TIMEOUTS.UI });
  });
});
