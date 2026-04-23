/**
 * wait.ts — Shared wait utilities for HiSpark Studio AI E2E tests
 *
 * All helpers use element-based waiting (waitFor / waitForSelector).
 * Never use page.waitForTimeout() — backend scripts have variable duration.
 */

import { FrameLocator, Page } from 'playwright';

// Timeouts (ms)
export const TIMEOUTS = {
  // Extension activation + WebView mount
  ACTIVATION: 20_000,
  // Backend script execution (quantize / convert can take minutes)
  SCRIPT: 180_000,
  // Normal UI interaction (click → DOM update)
  UI: 10_000,
  // History table row to appear after triggering an operation
  HISTORY_ROW: 180_000,
} as const;

/**
 * Wait for the HiSpark panel to be open and the React app to be ready.
 * Call this at the start of any test that begins from a cold launch.
 */
export async function waitForAppReady(webview: FrameLocator): Promise<void> {
  await webview
    .locator('[data-testid="app-ready"]')
    .waitFor({ state: 'attached', timeout: TIMEOUTS.ACTIVATION });
  await webview
    .locator('.ant-steps')
    .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
}

/**
 * Navigate to a pipeline step by clicking its label in the Ant Design Steps
 * navbar. Waits for the target page heading to be visible before returning.
 *
 * @param webview   Inner frame locator from the webview fixture
 * @param stepText  Visible step label, e.g. 'Select Model', 'Quantize'
 * @param landingSelector  A selector unique to the target page, used to
 *                         confirm navigation completed
 */
export async function clickNavStep(
  webview: FrameLocator,
  stepText: string,
  landingSelector: string,
): Promise<void> {
  await webview
    .locator('.ant-steps-item')
    .filter({ hasText: stepText })
    .click();
  await webview
    .locator(landingSelector)
    .waitFor({ state: 'visible', timeout: TIMEOUTS.UI });
}

/**
 * Wait for a new row to appear in a history table (Quantization Result History
 * or Conversion Result History). Returns the first row locator (sorted
 * descending by updateTime, so first = most recent).
 *
 * Does NOT assert absolute row count — tolerates pre-existing rows.
 */
export async function waitForNewHistoryRow(
  webview: FrameLocator,
  sectionTestId: 'history-section',
): Promise<ReturnType<FrameLocator['locator']>> {
  const section = webview.locator(`[data-testid="${sectionTestId}"]`);
  const firstRow = section.locator('.ant-table-row').first();
  await firstRow.waitFor({ state: 'visible', timeout: TIMEOUTS.HISTORY_ROW });
  return firstRow;
}

/**
 * Fill a file path input within a Calibration or Validation Inputs table row.
 * The input is identified by its sibling label text (Input Node column) and
 * the section heading text.
 *
 * The implementation uses fill() + Tab to trigger React's onChange + onBlur
 * cycle, which commits the value into component state.
 *
 * @param webview        Inner frame locator
 * @param sectionHeading e.g. 'Calibration Inputs'
 * @param inputNodeLabel e.g. 'Input3'
 * @param filePath       Absolute path to fill in
 */
export async function fillPathInput(
  webview: FrameLocator,
  sectionHeading: string,
  inputNodeLabel: string,
  filePath: string,
): Promise<void> {
  // The FileInputBoxComponent renders a text <input> next to the label.
  // We locate the section container, then find the input in the row that
  // contains the inputNodeLabel text.
  const section = webview
    .locator('.inputs-class-cpu, .inputs-class-table')
    .filter({ hasText: sectionHeading });

  const row = section.locator('.row-ptq, .cpuSed').filter({ hasText: inputNodeLabel });
  const input = row.locator('input[type="text"]').first();

  await input.fill(filePath);
  await input.press('Tab');
}

/**
 * Open the VSCode HiSpark panel by triggering the command palette.
 * Use this in a beforeAll if the panel isn't open on cold launch.
 */
export async function openHiSparkPanel(page: Page): Promise<void> {
  // Focus VSCode and open the command palette.
  await page.keyboard.press('F1');
  await page.waitForSelector('.quick-input-widget', { timeout: TIMEOUTS.UI });
  await page.keyboard.type('HisparkAI: Home');
  await page.keyboard.press('Enter');
}
