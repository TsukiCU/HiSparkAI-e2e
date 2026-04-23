# Frontend Source Changes for E2E Tests

All changes are `data-testid` attribute additions only. No business logic was modified.
The patch at `frontend.patch` can be applied with `git apply` or reviewed file-by-file below.

---

## Modified Files

### 1. `code/src/frontEnd/routes/app.tsx`

| Element | Change | Required by |
|---------|--------|-------------|
| `<div className="chip-setting">` | Added `data-testid="app-ready"` | WebView fixture readiness gate (fixtures/webview.ts) |

**Why:** The webview fixture must know when the React app has fully mounted inside the double-nested iframe. This attribute is added to the outermost rendered element so it appears the moment React mounts — before any async data is loaded. The fixture waits for it before yielding the frame to any test.

---

### 2. `code/src/frontEnd/routes/SelectModel.tsx`

| Element | Change | Required by |
|---------|--------|-------------|
| Trash icon `<img>` in history row | Added `data-testid="history-delete-btn"` | Future cleanup tests; not used in current TC-01–TC-08 |
| "Next" `<Button>` in history row | Added `data-testid="history-next-btn"` | TC-01: click to proceed from history to Quantize |

**Why:** The history table renders rows dynamically from Redux state. The "Next" button text is not unique within the page (History also has "Next" buttons in the result tables below), so a testid is required to distinguish this specific button from result-row Next buttons.

**Note on `history-delete-btn`:** This testid is added now but not used in any current test case. The current isolation strategy tolerates pre-existing history entries (as specified in the plan §6) rather than deleting them. The testid is included so that a future cleanup helper can target the button without requiring another code change.

---

### 3. `code/src/frontEnd/routes/Quantize.tsx`

| Element | Change | Required by |
|---------|--------|-------------|
| "Next Without Quantization" `<Button>` | Added `data-testid="skip-quantization-btn"` | TC-02: fast-path to Convert |
| CPU "Quantize" `<Button>` | Added `data-testid="quantize-btn"` | TC-03, TC-04, TC-05: trigger quantization |
| Validation Labels `<Select>` (CPU path) | Added `data-testid="validation-labels-select"` | TC-05: select output node |
| Validation Labels `<Select>` (NPU PTQ path) | Added `data-testid="validation-labels-select"` | TC-05 (NPU, future) |
| CPU Validation `SwitchBoxComponent` | Added `testId="validation-toggle"` prop | TC-03/04/05 setup: assert toggle state |
| Histogram `CommonCard` | Wrapped in `<div data-testid="histogram-section">` | TC-05: assert histogram appears |

**Why for validation-labels-select:** The `<Select>` placeholder text is in Chinese (`请选择输出节点`) — not stable as a selector. A testid is required.

**Why for validation-toggle:** The isolation section in the plan references this testid to assert the Validation toggle state between tests. The `SwitchBoxComponent` did not previously accept a `testId` prop — a `testId?: string` prop was added to its interface and wired to the wrapping `<div>`.

---

### 4. `code/src/frontEnd/routes/Convert.tsx`

| Element | Change | Required by |
|---------|--------|-------------|
| "Convert" `<Button>` | Added `data-testid="convert-btn"` | TC-07, TC-08: trigger conversion |

**Why:** "Convert" appears as both the page section heading and the button text. The testid disambiguates the clickable button from the heading.

---

### 5. `code/src/frontEnd/routes/utils/History.tsx`

| Element | Change | Required by |
|---------|--------|-------------|
| `<section className="history">` | Added `data-testid="history-section"` | All TCs: wait for result rows |
| "Next" `<button>` inside `<NavLink>` | Added `data-testid="result-next-btn"` | TC-06: navigate from Quantize result to Convert |

**Why for history-section:** Tests wait for a new row to appear after triggering Quantize/Convert. The `[data-testid="history-section"] .ant-table-row` compound selector is the stable way to scope row lookups to the result table vs. any other table on the page.

**Why for result-next-btn:** There are multiple "Next" buttons on the Quantize page (one per history row, plus the history model-selection Next). The testid on the result-row Next (inside `History.tsx`) disambiguates it from the `history-next-btn` in `SelectModel.tsx`.

---

### 6. `code/src/frontEnd/routes/utils/Switch.tsx`

| Element | Change | Required by |
|---------|--------|-------------|
| `SwitchBoxComponentProps` interface | Added `testId?: string` prop | Enables passing testids to switch instances |
| Destructuring in component body | Added `testId` to destructured props | Required to use the prop |
| `<div className="switchContainer">` | Added `data-testid={testId}` | TC-03/04/05: locate validation toggle |

**Why:** `SwitchBoxComponent` is a shared component used for multiple toggle controls. Making `testId` optional means existing usages without the prop are unaffected — the `data-testid` attribute is only rendered when the prop is explicitly passed.

---

## Attribute Summary

| `data-testid` value | File | Test(s) |
|--------------------|------|---------|
| `app-ready` | app.tsx | All (fixture gate) |
| `history-delete-btn` | SelectModel.tsx | TC-01 cleanup |
| `history-next-btn` | SelectModel.tsx | TC-01 |
| `skip-quantization-btn` | Quantize.tsx | TC-02, TC-08 |
| `quantize-btn` | Quantize.tsx | TC-03, TC-04, TC-05 |
| `validation-labels-select` | Quantize.tsx | TC-05 |
| `validation-toggle` | Quantize.tsx (via Switch.tsx) | TC-03, TC-04, TC-05 setup |
| `histogram-section` | Quantize.tsx | TC-05 |
| `convert-btn` | Convert.tsx | TC-07, TC-08 |
| `history-section` | History.tsx | TC-03–TC-08 |
| `result-next-btn` | History.tsx | TC-06 |
