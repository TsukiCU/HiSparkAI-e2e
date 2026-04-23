E2E Test Framework Plan
1. e2e/ Project Structure
Directory tree:


e2e/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── fixtures/
│   ├── base.ts           ← base test fixture (Electron launch + frame access)
│   └── webview.ts        ← inner frame fixture exported for all tests
├── tests/
│   ├── 00-select-model.spec.ts
│   ├── 01-quantize-skip.spec.ts
│   ├── 02-quantize-cali-only.spec.ts
│   ├── 03-quantize-cali-validation.spec.ts
│   ├── 04-convert.spec.ts
│   └── 05-full-pipeline.spec.ts
└── helpers/
    └── wait.ts           ← shared timeout helpers
package.json — key dependencies with rationale:


{
  "devDependencies": {
    "playwright": "^1.44.0",
    "@playwright/test": "^1.44.0",
    "typescript": "^5.4.0"
  }
}
playwright 1.44+: Required for _electron launch API and stable frameLocator chaining. Avoid ^1.40 or earlier — those have known frameLocator iframe reattachment races in Electron.
No ts-jest needed here; @playwright/test runs TypeScript natively via its own transpiler.
No electron package as a direct dep — Playwright's _electron.launch drives the system-installed VSCode binary directly.
tsconfig.json:


{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": { "@e2e/*": ["./*"] }
  },
  "include": ["**/*.ts"]
}
VSCode launch approach:


// fixtures/base.ts
import { _electron as electron } from 'playwright';
const app = await electron.launch({
  executablePath: '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
  args: [
    '--extensionDevelopmentPath=/Users/hongyusun/2026/HiSparkAI/code',
    '--disable-workspace-trust',
    '--no-sandbox',
    '--disable-gpu',
  ],
});
--extensionDevelopmentPath points to code/ (the extension root containing package.json and dist/). VSCode loads the extension in development mode from there.
Build output is at code/dist/extension.js and code/dist/index.html (per package.json "main": "./dist/extension" and chipconfigpanel.ts reading dist/index.html).
The extension must be built (yarn compile in code/) before tests run. The playwright.config.ts globalSetup hook will verify code/dist/extension.js exists and bail with a clear message if not.
2. WebView Access Strategy
The iframe nesting based on CLAUDE.md and the VSCode WebView architecture:


Electron window (page)
  └── <iframe>                           ← VSCode's webview host container
        └── <iframe id="active-frame">   ← React app lives here
Locating the frame:


// fixtures/webview.ts
export async function getWebViewFrame(page: Page): Promise<FrameLocator> {
  // Layer 1: first iframe in the Electron window
  const outer = page.frameLocator('iframe');
  // Layer 2: iframe#active-frame inside the outer frame
  const inner = outer.frameLocator('iframe#active-frame');
  return inner;
}
Fixture structure (using Playwright's test.extend):


// fixtures/base.ts
type MyFixtures = {
  app: ElectronApplication;
  page: Page;
  webview: FrameLocator;
};

export const test = base.extend<MyFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({ ... });
    await use(app);
    await app.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await use(page);
  },
  webview: async ({ page }, use) => {
    // Wait for app-ready gate (see §3) before yielding the frame
    const outer = page.frameLocator('iframe');
    const inner = outer.frameLocator('iframe#active-frame');
    await inner.locator('[data-testid="app-ready"]').waitFor({ timeout: 15000 });
    await use(inner);
  },
});
Every test imports test from fixtures/base.ts and receives webview directly — no per-test frame traversal.

The FrameLocator reference returned by frameLocator() is not a live object that stales; it recomputes the frame on each .locator() call. Caching the FrameLocator instance (not the Frame) is therefore safe and correct.

3. Extension Readiness Strategy
The problem: After electron.launch, the extension activates asynchronously. ChipConfigPanel.toggle() injects window.initialState and window.initialData into the HTML, then calls postInitTarget. The React app mounts and starts Redux saga workflows. There is no existing DOM signal for "fully ready."

Strategy: Add a single data-testid="app-ready" attribute to the outermost <div> in app.tsx. This element is rendered immediately on mount — it does not depend on any async data — so its presence in the DOM is a valid readiness gate for the frame being loaded and React having mounted.

Required source change (minimal):

In code/src/frontEnd/routes/app.tsx:60, change:


// Before
<div className="chip-setting">
// After
<div className="chip-setting" data-testid="app-ready">
This is the only source change needed for readiness detection. The fixture waits:


await inner.locator('[data-testid="app-ready"]').waitFor({ timeout: 15000 });
Additional initialization needed before interactions: After app-ready appears, SelectModel fires queryData() on mount which fetches history via vscode.postMessage. The response comes back asynchronously. Tests that depend on the history table must wait for actual row content, not just the readiness gate. The test will assert inner.locator('.config-card').first().waitFor() or similar.

4. data-testid Additions Required
Only elements that cannot be reliably targeted by text or ARIA role. "Quantize", "Convert", "Next", "Import Model" are stable button texts — no testid needed. Elements that need testids:

File	Element description	Proposed data-testid	Required for
app.tsx:60	Root <div className="chip-setting">	app-ready	Readiness gate (§3)
SelectModel.tsx:140	"Next" button in history row	history-next-btn	Click to proceed to Quantize
SelectModel.tsx:141	Trash icon in history row	history-delete-btn	State cleanup: delete entries
Quantize.tsx:1517	"Next Without Quantization" button	skip-quantization-btn	Fast-path test (Mode 1)
Quantize.tsx:1471	"Quantize" button (CPU PTQ path)	quantize-btn	Click to start quantization
Convert.tsx:651	"Convert" button	convert-btn	Click to start conversion
History.tsx:567	<section className="history">	history-section	Assert history table present
History.tsx:219	"Next" button in result history row	result-next-btn	Navigate to Convert/Deploy from history
Notes on selection strategy:

The Quantize calibration path inputs (FileInputBoxComponent) are targeted by their title label text (e.g., Input3) combined with input role — no testid needed.
The "Validation" toggle (SwitchBoxComponent with selectBox.title === 'Validation') can be targeted by its rendered label text "Validation" — no testid needed.
The "Validation Labels" <Select> uses placeholder="请选择输出节点" — needs a testid since the placeholder is in Chinese and unstable. Add data-testid="validation-labels-select" to the <Select> element in Quantize.tsx:1451 and Quantize.tsx:1115.
Total additions: 10 attributes across 4 files (app.tsx, SelectModel.tsx, Quantize.tsx, Convert.tsx, History.tsx).

5. Test Case Inventory
All tests use the webview fixture from §2. "From history" means a model entry for mnist-12.onnx already exists in extension storage.

Prerequisite note: data/mnist/ does not exist as documented in CLAUDE.md. The actual data is at data/lite/ (calibration .npy files + label.csv) and data/test/npy/ + data/test/label_test.csv. Tests will use these real paths.

TC-01: Select model from history

Setup: model entry exists in history (pre-condition verified by asserting at least one .config-card row)
Actions: navigate to SelectModel page; assert history entry with text mnist-12.onnx is visible; click [data-testid="history-next-btn"] on that row
Assertion: Quantize page loads; h2.section-title with text "Model currently selected" is visible; model filename mnist-12.onnx appears in the <span> beside the model icon
TC-02: Skip quantization (Mode 1 — fast path to Convert)

Setup: TC-01 passed (on Quantize page with model selected)
Actions: click [data-testid="skip-quantization-btn"]
Assertion: Convert page loads (URL hash becomes #/convert); "Model currently selected" shows mnist-12.onnx; no new row in Quantization Result History (table remains empty or count unchanged)
TC-03: Quantize — calibration only (Mode 2)

Setup: on Quantize page, Validation toggle is off (default)
Actions: locate the first FileInputBoxComponent under "Calibration Inputs" (Input Node Input3); fill() with absolute path to data/lite/; click [data-testid="quantize-btn"]
Assertion: wait (no fixed timeout) for [data-testid="history-section"] to contain a new row; the most recently added row has model name containing mnist-12
Flag: this test executes a real backend script. If the backend tool is not installed on the test machine, the script will fail with a vscode.window.showErrorMessage notification. The test should assert on the success case and document the environment prerequisite.
TC-04: Quantize — calibration + validation, no labels (Mode 3)

Setup: on Quantize page
Actions: enable Validation toggle (click the <Switch> next to "Validation"); fill Calibration Inputs path with data/lite/; fill the Validation Inputs path (the second FileInputBoxComponent group) with data/test/npy/; leave Validation Labels as None; click [data-testid="quantize-btn"]
Assertion: new row appears in Quantization Result History
TC-05: Quantize — calibration + validation + labels (Mode 4)

Setup: on Quantize page
Actions: enable Validation toggle; fill Calibration path with data/lite/; fill Validation Inputs path with data/test/npy/; open [data-testid="validation-labels-select"] and select a non-None output node (e.g., Plus214_Output_0); fill the labels file path with data/test/label_test.csv; click [data-testid="quantize-btn"]
Assertion: new history row appears; the Probability Density Histogram <canvas> element (rendered by HistogramGraph) becomes visible — assert [data-testid="histogram-section"] canvas is visible
Note: Add data-testid="histogram-section" to the CommonCard wrapper in Quantize.tsx:1534 (one more testid, not in the table above but needed here)
TC-06: Proceed to Convert from quantization result

Setup: at least one row in Quantization Result History (TC-03 ran successfully)
Actions: click [data-testid="result-next-btn"] on the most recent row (first row after sort by updateTime desc)
Assertion: Convert page loads; "Model currently selected" shows the model name; "Convert Config" table shows at least one input node row
TC-07: Execute Convert

Setup: on Convert page (from TC-06 or TC-02)
Actions: click [data-testid="convert-btn"]
Assertion: wait for a new row in [data-testid="history-section"] within Conversion Result History; the Conversion Result panel (ConvertStarkGraph) renders (assert canvas element is visible)
Flag: requires real backend. Same caveat as TC-03.
TC-08: Full pipeline (smoke test)

Actions: TC-01 → TC-02 (skip quantize) → TC-07 (convert)
Assertion: Convert page shows a result row after clicking Convert
This is the fastest fully-automated pipeline path.
Cases that cannot be fully automated:

Case	Constraint
Import new model (Windows/WSL)	OS-native file dialog, CLAUDE.md §4
Import new model (Linux)	SSH-based remote plugin, CLAUDE.md §4
NPU Quantize (PTQ/QAT)	Undocumented UI, flows/overview.md
Deploy / Benchmark	Out of scope, flows/overview.md
TC-03/04/05/07 on machines without backend tools	Backend scripts require toolchain install
6. Test Isolation & State Management
Core principle: The extension persists state in context.globalStorageUri (see chipconfigpanel.ts:45 reading projectlist.json) and likely in separate JSON files for compression/convert history. Tests cannot assume a clean state.

Concrete strategies:

History tables (Quantize / Convert): Do not assert absolute row count. Always assert on the presence of the most recently added row. The History component sorts by updateTime descending and renders the freshest row at top (History.tsx:368: data.sort((a, b) => b.updateTime - a.updateTime)). Use:


// Always grab the first row after an operation
const firstRow = webview.locator('[data-testid="history-section"] .ant-table-row').first();
await firstRow.waitFor({ state: 'visible', timeout: 120_000 });
Select Model history: The test setup must tolerate pre-existing entries. TC-01 asserts on presence of a row matching mnist-12.onnx by text (getByText) rather than asserting the table has exactly N rows.

Between-test state reset (without VSCode restart): For the Quantize page, the form state is loaded from Redux/backend storage when navigating to the page. To ensure a clean form between test cases:

Navigate back to SelectModel (webview.locator('.select-desc').filter({ hasText: 'Select Model' }).click())
Re-click the model's "Next" button to re-enter Quantize — this triggers clearReduxSaveId() in SelectModel.tsx:159, which resets lastQuantTS, lastConvertTS, etc.
The Quantize form reloads compressionData from backend storage, which was saved by the previous test. This means file path fields may be pre-filled. The test must fill() all path inputs explicitly (overwriting any prior value) rather than checking if empty.
VSCode restart is only needed when: Extension storage JSON is corrupted, or the navbarStatus Redux state is in an unrecoverable state. In practice, re-navigating via SelectModel's Next button is sufficient for the in-scope tests.

Validation toggle default: switchMode in Quantize.tsx:82 initializes to false, but updateBtnStatus restores the persisted value on page load. TC-03 must explicitly verify the toggle is off (assert [data-testid="validation-toggle"] has aria-checked="false") or click it to the known-off state before filling paths.

7. Risk Register
Risk	Component / Behavior	Mitigation
iframe#active-frame selector breaks across VSCode versions	VSCode's internal webview host uses this id, but it's not a public API	Pin VSCode binary version in CI; add a fallback selector iframe:nth-child(2) if the primary fails
postInitTarget is called before React mounts — app-ready div may flash before init message is processed, so target is 'NONE' and WelcomePage renders instead of App	index.tsx:28 — target is read from window.initialState.target synchronously at module load, not from the init message. If initialState is not injected before JS runs (race in chipconfigpanel.ts:64-84), the app renders WelcomePage	Wait for [data-testid="app-ready"] AND assert the Quantize/SelectModel navbar is visible before proceeding; if WelcomePage renders, retry opening the panel via HisparkAI.openHome command
File path inputs are FileInputBoxComponent which internally uses Ant Design Input — fill() may be intercepted by React's synthetic event system and not trigger state update	ProPathComponents.tsx uses onInputChange callback	Use fill() followed by press('Tab') to trigger onBlur / state commit; verify the value stuck by inputValue() before clicking Quantize
Calibration path inputs are dynamically rendered — the number of FileInputBoxComponent rows depends on model output nodes loaded from backend	Quantize.tsx:1258: setLen = inputBoxes.length - 1	Always wait for at least one calibration row to appear before filling; use nth(0) to target the first row rather than a fixed index
History table Next button is inside a NavLink which navigates via React Router — Playwright navigation detection may not fire	History.tsx:220 uses <NavLink> which triggers a hash change, not a full page load	Assert the new page by waiting for a page-specific element (e.g., "Convert Config" heading) rather than using page.waitForNavigation()
compressionData is loaded from backend storage asynchronously on Quantize page mount — form fields are empty until the init message roundtrip completes	Quantize.tsx:642-732: useEffect on compressionData populates all form fields	Wait for a calibration path input element to be visible (not just the page) before attempting fill()
Extension script execution (Quantize/Convert) may take minutes or fail silently if toolchain not installed	Quantize.tsx:238-241: only QuantSuccess/QuantFailed messages signal completion	Set timeout: 180_000 on result row wait; add a secondary assertion that the notify() error toast (Ant message component) has NOT appeared
Model history may be empty on a fresh machine (no prior manual import)	SelectModel.tsx:218-232 — table empty state renders if historyInfoData is null	Document as a test prerequisite: at least one manual import must have been done; provide a setup script that seeds extension storage JSON with a mock model entry
Summary of files to modify in code/:

File	Change
app.tsx:60	Add data-testid="app-ready" to root div
SelectModel.tsx:140-141	Add data-testid to "Next" and trash icon in history row render
Quantize.tsx:1517	Add data-testid="skip-quantization-btn" to "Next Without Quantization" button
Quantize.tsx:1471	Add data-testid="quantize-btn" to "Quantize" button (CPU path)
Quantize.tsx:1451 and 1115	Add data-testid="validation-labels-select" to <Select>
Quantize.tsx:1534	Add data-testid="histogram-section" to histogram CommonCard
Convert.tsx:651	Add data-testid="convert-btn" to "Convert" button
History.tsx:567	Add data-testid="history-section" to <section>
History.tsx:220	Add data-testid="result-next-btn" to "Next" button
Confirm this plan before implementation begins. The items above define the complete scope of code changes and test structure. Nothing will be written until you approve.