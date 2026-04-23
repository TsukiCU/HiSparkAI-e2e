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
│   ├── lite/
│   ├── test/
│   └── train/
├── e2e/           THIS project — Playwright E2E tests  ← you are here
│   ├── CLAUDE.md  (this file)
│   └── flow.md    UI walkthrough with annotated screenshots — READ THIS FIRST
└── prompt/        Prompt history (ignore during implementation)
```

## The Plugin's Core Flow

The plugin is a linear pipeline with 5 steps shown as a top navbar:

**Select Model → Quantize → Convert → Deploy → Benchmark**

Each step is a separate WebView "page". State carries forward (the selected model persists across steps). Tests should be designed to reflect this sequential nature while remaining independently runnable where feasible.

Key behaviors documented in `flow.md` (read it, look at the screenshots):
- **Home** page has Project List, New Project, Import Project
- **Select Model** page has History Files list and Import Model button
- **Quantize** page has 4 distinct execution modes, a Validation toggle that reveals extra inputs, a Validation Labels dropdown that enables a file picker, and a results history table
- **Convert** page requires no configuration — just click Convert
- Results appear in history tables and side panels (charts/bar graphs)

## Technical Decisions Already Made

**Framework:** Playwright with Electron launch (`_electron` API), running against a real VSCode instance with the extension loaded in development mode.

**Why Playwright over other options:** The WebView is React-based and lives inside a sandboxed iframe. Playwright is the only tool that can reliably interact with both the VSCode shell and the WebView DOM in the same test.

## Critical Technical Gotchas — Read Before Writing Any Test

### 1. WebView is Double-Nested
The React app does NOT live directly on the page. It's nested two levels deep:
```
Electron window (page)
  └── iframe  (VSCode's webview host)
        └── iframe#active-frame  (your React app)
```
Use `frameLocator` chaining to reach it. Cache the inner frame reference in a fixture; don't re-traverse the chain in every test.

### 2. Extension Activation is Async
After VSCode launches, the extension activates asynchronously. The WebView may not exist yet. Always wait for a known stable element before interacting — add a `data-testid="app-ready"` marker to the root component and use it as the readiness gate.

### 3. File Path Inputs Accept Direct Text — Use This
**All file path input fields in the UI support direct text input.** This completely bypasses the OS native file dialog problem. Use `fill()` to set paths programmatically. Point them at files in `../data/` — those test datasets already exist. Do not attempt to automate OS file dialogs.

### 4. State May Persist Between Tests
The extension may retain project state (last opened project, history table entries) across test runs. Design the test setup to handle a dirty initial state, or implement a reset mechanism. History tables growing unboundedly across runs will eventually break assertions about row counts.

### 5. Script Execution Takes Variable Time
Quantize and Convert trigger real backend scripts. On slow machines or CI, these can take significantly longer than locally. Use `waitForSelector` with generous timeouts on result elements rather than fixed waits. Never use `page.waitForTimeout()`.

### 6. Selector Strategy
Add `data-testid` attributes to interactive elements and assertion targets in the React components. Keep it minimal — only elements tests need to `click()`, `fill()`, or `expect().toBeVisible()`. Use text-based selectors only for truly stable, non-internationalizable labels.

## Constraints on `code/`

- **Do not modify business logic.** The only acceptable changes to `code/` are adding `data-testid` attributes to JSX elements.
- Keep a list of every file you modify in `code/` so changes are easy to review and revert.
- The extension must build cleanly (`build.sh` / `build.bat`) after any modifications.

## How to Start

1. Read `flow.md` and all screenshots carefully — this is your ground truth for UI behavior
2. Explore `code/src/frontEnd/routes/` to understand each page's component structure
3. Explore `code/src/backEnd/panels/` to understand how WebView panels are managed
4. Check `code/package.json` and `build.sh` to understand the build output location
5. Look at `data/` to understand what test files are available
6. **Propose a complete plan** (project structure, library choices, data-testid list, test case inventory) before writing any code or modifying any files
7. Wait for confirmation, then implement
