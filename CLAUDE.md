# HiSpark Studio AI — E2E Test Project

## What This Is

Automated end-to-end tests for the **HiSpark Studio AI** VSCode extension — an AI toolkit for HiSilicon edge devices (model quantization, conversion, deployment, benchmarking). The goal is to replace manual click-through testing entirely with code-driven tests.

## Repository Layout

```
HiSparkAI/
├── code/          VSCode extension source (TypeScript + React WebView)
│   └── src/
│       ├── extension.ts          Extension entry point
│       ├── frontEnd/             React app (the WebView UI)
│       │   ├── routes/           One file per pipeline step
│       │   │   ├── SelectModel.tsx
│       │   │   ├── Quantize.tsx
│       │   │   ├── Convert.tsx
│       │   │   ├── Deploy.tsx
│       │   │   └── Benchmark.tsx
│       │   └── component/        Shared UI components
│       └── backEnd/              Extension Host logic, panel management
├── data/          Pre-existing test datasets — use these as test fixtures
│   ├── cali/                     calibration data (.npy files)
│   ├── vali/                     validation data (.npy files)
│   ├── label.csv                 labels file
│   └── backup/                   backup copies (ignore in tests)
├── e2e/           THIS project — Playwright E2E tests  ← you are here
│   ├── CLAUDE.md  (this file)
│   └── flows/     UI documentation — READ BEFORE WRITING TESTS
│       ├── overview.md           pipeline map, platform/SDK matrix, implementation status
│       ├── 00-home/
│       ├── 01-select-model/
│       ├── 02-quantize/          contains cpu-ptq.md (✅), npu-ptq.md (❌), npu-qat.md (❌)
│       ├── 03-convert/
│       ├── 04-deploy/            ❌ out of scope
│       └── 05-benchmark/         ❌ out of scope
└── prompt/        Prompt history (ignore during implementation)
```

## The Plugin's Core Flow

The plugin is a linear pipeline with 5 steps shown as a top navbar:

**Select Model → Quantize → Convert → Deploy → Benchmark**

State carries forward (the selected model persists across steps). Tests should reflect this sequential nature while remaining independently runnable where feasible.

## Platform × SDK Matrix

This is important for scoping tests correctly.

| SDK  | Platform      | Quantize UI  | Convert UI |
|------|---------------|-------------|------------|
| CPU  | Windows / WSL | PTQ only    | Basic      |
| CPU  | Linux         | Same        | Same       |
| NPU  | Windows / WSL | PTQ + QAT   | + extra param field |
| NPU  | Linux         | Same        | Same       |

**Rules:**
- WSL and Windows share identical WebView UI — one test covers both
- NPU and CPU have **structurally different Quantize pages**
- The only cross-platform UI difference is "Import New Model" in Select Model (see flows/01-select-model)
- Deploy and Benchmark have NPU/CPU differences but are out of scope

## Current Test Scope

Focus on: **CPU path, Windows/WSL, from-history model selection, Select Model → Quantize → Convert**

This is the only fully documented path. Do not write tests for undocumented variants.

## Technical Decisions Already Made

**Framework:** Playwright with Electron launch (`_electron` API), running against a real VSCode instance with the extension loaded in development mode.

## Critical Technical Gotchas — Read Before Writing Any Test

### 1. WebView is Double-Nested
The React app does NOT live directly on the page. It's nested two levels deep:
```
Electron window (page)
  └── iframe  (VSCode's webview host)
        └── iframe#active-frame  (your React app)
```
Use `frameLocator` chaining to reach it. Cache the inner frame reference in a shared fixture.

### 2. Extension Activation is Async
After VSCode launches, the extension activates asynchronously. Always wait for a known stable element before interacting. Add a `data-testid="app-ready"` marker to the root component and use it as the readiness gate.

### 3. File Path Inputs Accept Direct Text — Use This
**All file path inputs in the UI support direct text entry.** Use `fill()` with absolute paths pointing to `../data/`. The correct test data paths are:
- Calibration Inputs: `<repo_root>/data/cali/`
- Validation Inputs: `<repo_root>/data/vali/`
- Validation Labels file: `<repo_root>/data/label.csv`

Always resolve paths with `path.resolve()` relative to the test file location — never hardcode absolute paths. Do not interact with the folder-picker icon buttons. Do not attempt to automate OS file dialogs.

### 4. Import New Model is Not Automatable
"Import New Model" on Select Model page opens either an OS-native file dialog (Windows/WSL) or an SSH-based remote plugin (Linux). Neither is automatable with Playwright. Tests must pre-seed model history or use a model already present in History Files.

### 5. State Persists Between Tests
The extension retains project state and history table entries across runs. History tables grow unboundedly. Do not assert on absolute row counts — assert only on the presence and content of the most recently added row. Design setup steps to tolerate a dirty initial state.

### 6. Script Execution Time is Variable
Quantize and Convert trigger real backend scripts. Use `waitForSelector` with generous timeouts. Never use `page.waitForTimeout()`.

### 7. Selector Strategy
Add `data-testid` attributes only to elements tests need to `click()`, `fill()`, or assert visibility on. Keep the total count minimal. Prefer stable text selectors for elements with non-translatable labels.

## Constraints on `code/`

- **Do not modify business logic.** Only acceptable change: adding `data-testid` attributes to JSX elements.
- Track every modified file so changes can be reviewed and reverted independently.
- The extension must build cleanly after modifications.

## Debugging & Observability Requirements

Every test file must be written to maximize failure visibility:

1. **Named steps:** Wrap every logical step in `await test.step('description', async () => { ... })`. Failure reports must show which named step failed, not just a line number.
2. **Assertion messages:** Every `expect()` call must include a descriptive second argument, e.g. `expect(el, 'History Files heading should be visible').toBeVisible()`.
3. **playwright.config.ts** must be configured with `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, and `trace: 'retain-on-failure'` so failures produce artifacts automatically.
4. **Console capture:** The webview fixture must forward WebView console messages to the test output so frontend errors appear in the failure log.

## Working Convention

After every session where you write or modify files, end your response with a **Brief Summary** section listing:
- Which files were created or modified
- One line per file describing what changed and why

Example format:
```
## Brief Summary
- `fixtures/base.ts` — replaced temp workspace creation with env-var-driven workspace path
- `.env.example` — added WORKSPACE_PATH variable
- `e2e/CLAUDE.md` — added working convention section
```

## How to Start

1. Read `flows/overview.md` for the complete picture
2. Read each flow file for the pages in scope (00-home through 03-convert, CPU PTQ only)
3. Explore `code/src/frontEnd/routes/` to map flow descriptions to actual component structure
4. Explore `code/src/backEnd/panels/` to understand WebView lifecycle
5. Check `code/package.json` and `build.sh` for build output location
6. **Propose a complete plan** before writing any code or modifying any files
7. Wait for confirmation, then implement
