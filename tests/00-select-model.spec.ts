/**
 * TC-01: Select model from History Files
 *
 * PREREQUISITES:
 *   - At least one model entry must already exist in History Files before this
 *     suite runs. There is no automated seed step. Perform at least one manual
 *     "Import Model" to populate history, then run these tests.
 *   - The HiSpark Studio AI panel must be open (triggered by clicking the
 *     sidebar icon) before the webview fixture can resolve the iframe.
 *
 * COVERS:
 *   - History Files list renders at least one entry
 *   - Clicking "Next" on a history entry navigates to the Quantize page
 *   - The selected model filename carries through to the Quantize page
 *   - "Model currently selected" heading is visible on Quantize
 */

import { test, expect } from '../fixtures/webview';
import { TIMEOUTS } from '../helpers/wait';

test.describe('Select Model — from History Files', () => {
  test('TC-01: history entry is visible and Next navigates to Quantize', async ({ webview }) => {
    // ── 1. Assert we are on the Select Model page ────────────────────────────
    await expect(
      webview.locator('h2.section-title', { hasText: 'History Files' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── 2. Assert at least one history entry exists ───────────────────────────
    // PREREQUISITE: a prior manual import must have been done.
    const firstHistoryEntry = webview
      .locator('[data-testid="history-next-btn"]')
      .first();

    await firstHistoryEntry.waitFor({ state: 'visible', timeout: TIMEOUTS.UI });

    // ── 3. Capture the model name from the first entry for assertion later ────
    const modelNameEl = webview
      .locator('.config-card .sub-title span')
      .first();
    const modelNameText = await modelNameEl.textContent({ timeout: TIMEOUTS.UI });
    // modelNameText is e.g. "mnist-12.onnx (on Windows)"
    const modelFilename = modelNameText?.split(' (')[0]?.trim() ?? '';
    expect(modelFilename).toBeTruthy();

    // ── 4. Click Next on the first history entry ──────────────────────────────
    await firstHistoryEntry.click();

    // ── 5. Assert Quantize page loaded ───────────────────────────────────────
    await expect(
      webview.locator('h2.section-title', { hasText: 'Model currently selected' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── 6. Assert the model filename is shown on the Quantize page ────────────
    await expect(
      webview.locator('.model-selected span', { hasText: modelFilename })
    ).toBeVisible({ timeout: TIMEOUTS.UI });

    // ── 7. Assert the Quantize config section is present ─────────────────────
    await expect(
      webview.locator('h2.section-title', { hasText: 'Quantization Config' })
    ).toBeVisible({ timeout: TIMEOUTS.UI });
  });
});
