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
    await webview
      .locator('[data-testid="history-next-btn"]')
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // Capture the model filename for later assertion
    const modelNameEl = webview.locator('.config-card .sub-title span').first();
    const modelNameText = await modelNameEl.textContent({ timeout: TIMEOUTS.UI });
    const modelFilename = modelNameText?.split(' (')[0]?.trim() ?? '';
    expect(modelFilename).toBeTruthy();

    await webview.locator('[data-testid="history-next-btn"]').first().click();

    // Confirm navigation to Quantize
    await expect(
      webview.locator('h2.section-title', { hasText: 'Model currently selected' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // Confirm the model name carried through
    await expect(
      webview.locator('.model-selected span', { hasText: modelFilename })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── Step 2: Skip Quantization (TC-02) ─────────────────────────────────────
    await webview
      .locator('[data-testid="skip-quantization-btn"]')
      .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    await webview.locator('[data-testid="skip-quantization-btn"]').click();

    // Confirm we reached the Convert page
    await expect(
      webview.locator('h2.section-title', { hasText: 'Convert Config' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    await expect(
      webview.locator('h2.section-title', { hasText: 'Model currently selected' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── Step 3: Execute Convert (TC-07) ───────────────────────────────────────
    await webview
      .locator('[data-testid="convert-btn"]')
      .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    await webview.locator('[data-testid="convert-btn"]').click();

    // ── Step 4: Assert result row appears in Conversion Result History ─────────
    // ENVIRONMENT PREREQUISITE: backend conversion toolchain must be installed.
    const convertHistoryCard = webview
      .locator('.results-style')
      .locator('[data-testid="history-section"]');

    const firstConvertRow = convertHistoryCard.locator('.ant-table-row').first();
    await firstConvertRow.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });

    const modelCell = firstConvertRow.locator('.model-cell__name');
    await expect(modelCell).not.toBeEmpty({ timeout: TIMEOUTS.UI });

    // ── Step 5: Assert Conversion Result bar chart renders ────────────────────
    const resultPanel = webview.locator('.results-style');
    await expect(
      resultPanel.locator('canvas')
    ).toBeVisible({ timeout: TIMEOUTS.HISTORY_ROW });
  });
});
