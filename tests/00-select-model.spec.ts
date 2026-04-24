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
    await test.step('Assert Select Model page is visible (History Files heading)', async () => {
      await expect(
        webview.locator('h2.section-title', { hasText: 'History Files' }),
        'History Files heading should be visible on the Select Model page'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 2. Assert at least one history entry exists ───────────────────────────
    // PREREQUISITE: a prior manual import must have been done.
    await test.step('Assert at least one history entry exists', async () => {
      const firstHistoryEntry = webview
        .locator('[data-testid="history-next-btn"]')
        .first();

      await expect(
        firstHistoryEntry,
        'At least one history-next-btn should be visible (requires a prior model import)'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 3. Capture the model name from the first entry for assertion later ────
    const modelFilename = await test.step('Capture model filename from first history entry', async () => {
      const modelNameEl = webview
        .locator('[data-testid="history-model-name"]')
        .first();
      const modelNameText = await modelNameEl.textContent({ timeout: TIMEOUTS.UI });
      // modelNameText is e.g. "mnist-12.onnx (on Windows)"
      const filename = modelNameText?.split(' (')[0]?.trim() ?? '';
      expect(filename, 'Model filename extracted from history entry should be non-empty').toBeTruthy();
      return filename;
    });

    // ── 4. Click Next on the first history entry ──────────────────────────────
    await test.step('Click Next on the first history entry', async () => {
      await webview
        .locator('[data-testid="history-next-btn"]')
        .first()
        .click();
    });

    // ── 5. Assert Quantize page loaded ───────────────────────────────────────
    await test.step('Assert Quantize page loaded (Model currently selected heading)', async () => {
      await expect(
        webview.locator('h2.section-title', { hasText: 'Model currently selected' }),
        '"Model currently selected" heading should appear on the Quantize page after clicking Next'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 6. Assert the model filename is shown on the Quantize page ────────────
    await test.step('Assert selected model filename is shown on Quantize page', async () => {
      await expect(
        webview.locator('[data-testid="model-selected-name"]', { hasText: modelFilename }),
        `Model filename "${modelFilename}" should be displayed in the model-selected area on Quantize`
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });

    // ── 7. Assert the Quantize config section is present ─────────────────────
    await test.step('Assert Quantization Config section is present', async () => {
      await expect(
        webview.locator('h2.section-title', { hasText: 'Quantization Config' }),
        '"Quantization Config" section heading should be visible on the Quantize page'
      ).toBeVisible({ timeout: TIMEOUTS.UI });
    });
  });
});
