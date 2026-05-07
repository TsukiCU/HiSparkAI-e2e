# HiSpark Studio AI — E2E Tests

Automated end-to-end tests for the **HiSpark Studio AI** VSCode extension. Tests drive a real VSCode window via CDP (Chrome DevTools Protocol), interact with the extension's WebView UI, and cover the CPU quantization and conversion pipeline.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [One-time setup](#one-time-setup)
3. [Running the tests](#running-the-tests)
4. [Environment variables](#environment-variables)
5. [Test inventory](#test-inventory)
6. [Project structure](#project-structure)
7. [How the fixture works](#how-the-fixture-works)
8. [Troubleshooting](#troubleshooting)
9. [Test artifacts](#test-artifacts)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18 or 20 | Required by Playwright |
| npm or yarn | any | Either works |
| VSCode or Cursor | any recent | Must be installed on the test machine |
| HiSpark SDK workspace | — | Must contain the CPU/NPU sentinel file (see §4) |
| Prior model import | — | At least one model must exist in History Files (see §8) |

The tests run primarily on **Windows**. macOS and Linux are also supported with the same steps.

---

## One-time setup

### 1. Install dependencies

```bash
cd e2e
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all four variables. See [Environment variables](#environment-variables) for the exact values needed on your machine.

### 3. Build the extension

The extension must be compiled before tests can run. `globalSetup` verifies this and exits with a clear error if the build output is missing.

```bash
cd ../code
yarn compile
```

This produces `code/dist/extension.js` and `code/dist/index.html`. Re-run whenever you modify extension source.

### 4. Copy test files to `tmp/`

The Playwright config reads tests from `e2e/tmp/`. Copy the specs there before running:

```bash
# From the e2e/ directory:

# Windows
xcopy /E /Y tests\ tmp\

# macOS / Linux
cp -r tests/ tmp/
```

> **Why `tmp/`?** `testDir` is set to `tmp/` so you can copy only the specific tests you want to run without modifying the config each time.

---

## Running the tests

All commands must be run from the `e2e/` directory.

### Run all tests

```bash
npm test
```

### Run a single test file

```bash
npx playwright test tmp/00-select-model.spec.ts
```

### Run multiple specific files

```bash
npx playwright test tmp/00-select-model.spec.ts tmp/01-quantize-skip.spec.ts
```

### Watch the VSCode window while tests run

```bash
npm run test:headed
```

### Step through with the Playwright Inspector

```bash
npm run test:debug
```

### Open the interactive Playwright UI (recommended for development)

```bash
npm run test:ui
```

### View the HTML report from the last run

```bash
npx playwright show-report test-results
```

### View a trace from a failed test

```bash
npx playwright show-trace "test-results/<test-folder>/trace.zip"
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in all four values. This file is git-ignored and never committed.

### `VSCODE_EXECUTABLE_PATH`

Absolute path to the VSCode or Cursor binary on the test machine.

| Platform | Typical path |
|---|---|
| Windows — VSCode | `C:\Program Files\Microsoft VS Code\Code.exe` |
| Windows — Cursor | `C:\Users\yourname\AppData\Local\Programs\cursor\Cursor.exe` |
| macOS — VSCode | `/Applications/Visual Studio Code.app/Contents/MacOS/Electron` |
| macOS — Cursor | `/Applications/Cursor.app/Contents/MacOS/Cursor` |
| Linux | `/usr/share/code/code` |

### `EXTENSION_DEVELOPMENT_PATH`

Absolute path to the `code/` directory — the extension source root that contains `code/package.json` and `code/dist/`.

```
# Windows
EXTENSION_DEVELOPMENT_PATH=D:\tsuki\HiSparkAI\code

# macOS / Linux
EXTENSION_DEVELOPMENT_PATH=/Users/yourname/HiSparkAI/code
```

### `DATA_DIR`

Absolute path to the `data/` directory in this repository. It must contain:

- `data/cali/` — calibration `.npy` files
- `data/vali/` — validation `.npy` files
- `data/label.csv` — label file

```
# Windows
DATA_DIR=D:\tsuki\HiSparkAI\data

# macOS / Linux
DATA_DIR=/Users/yourname/HiSparkAI/data
```

### `WORKSPACE_PATH`

Absolute path to an SDK project folder that VSCode will open at launch. This folder must already exist on disk and must contain the sentinel file for your target platform:

- **CPU target:** `<WORKSPACE_PATH>\build\config\target_config\ws63\ws63.json`
- **NPU target:** `<WORKSPACE_PATH>\build\config\target_config\3322\3322.json`

```
# Windows
WORKSPACE_PATH=D:\tsuki\SDK\ws63

# macOS / Linux
WORKSPACE_PATH=/home/yourname/sdk/ws63
```

> **Windows path case:** VSCode internally lowercases the drive letter in workspace paths (e.g. `D:\` → `d:\`). The fixture normalises your `WORKSPACE_PATH` automatically — you can use uppercase in `.env`.

---

## Test inventory

Tests are numbered to reflect logical execution order. Each test starts fresh from the Select Model page (the fixture navigates there before yielding).

| File | ID | What it covers | Toolchain needed? |
|---|---|---|---|
| `00-select-model.spec.ts` | TC-01 | Select a model from History Files; navigate to Quantize | No |
| `01-quantize-skip.spec.ts` | TC-02 | "Next Without Quantization" — fast path to Convert without running the backend | No |
| `02-quantize-cali-only.spec.ts` | TC-03 | Quantize with calibration inputs only (Mode 2) | **Yes** |
| `03-quantize-cali-validation.spec.ts` | TC-04 | Quantize with calibration + validation inputs, no labels (Mode 3) | **Yes** |
| `04-quantize-with-labels.spec.ts` | TC-05 | Quantize with calibration + validation + labels, assert histogram (Mode 4) | **Yes** |
| `05-proceed-to-convert.spec.ts` | TC-06 | Click Next in a quantization result row; assert Convert page loads | No |
| `06-convert.spec.ts` | TC-07 | Execute conversion; assert result row and bar chart appear | **Yes** |
| `07-full-pipeline.spec.ts` | TC-08 | Full smoke test: Select Model → Skip Quantize → Convert | **Yes** |

**Toolchain needed** means the HiSpark quantization/conversion backend must be installed. TC-01, TC-02, and TC-06 do not trigger backend scripts and will pass without the toolchain.

### Fastest subset (no toolchain required)

```bash
npx playwright test \
  tmp/00-select-model.spec.ts \
  tmp/01-quantize-skip.spec.ts \
  tmp/05-proceed-to-convert.spec.ts
```

---

## Project structure

```
e2e/
├── .env                         Machine-specific config (git-ignored; you create this)
├── .env.example                 Template — copy to .env and fill in
├── .gitignore
├── .vscode-test-profile/        Persistent VSCode profile used by tests (git-ignored)
├── package.json
├── playwright.config.ts         testDir=tmp/, 180s timeout, screenshot/video/trace on failure
├── tsconfig.json
│
├── fixtures/
│   ├── base.ts                  Spawns VSCode via CDP; pre-seeds projectdata.json
│   └── webview.ts               Resolves the double-nested iframe; waits for readiness
│
├── helpers/
│   ├── globalSetup.ts           Pre-flight checks before any test runs
│   └── wait.ts                  Shared timeout constants (UI: 10s, HISTORY_ROW: 180s)
│
├── tests/                       Source test files — copy to tmp/ before running
│   ├── 00-select-model.spec.ts
│   ├── 01-quantize-skip.spec.ts
│   ├── 02-quantize-cali-only.spec.ts
│   ├── 03-quantize-cali-validation.spec.ts
│   ├── 04-quantize-with-labels.spec.ts
│   ├── 05-proceed-to-convert.spec.ts
│   ├── 06-convert.spec.ts
│   └── 07-full-pipeline.spec.ts
│
├── tmp/                         Tests run from here (git-ignored; populate manually)
├── test-results/                Playwright artifacts from the last run (git-ignored)
│
├── code-changes/
│   ├── frontend.patch           Unified diff of all data-testid additions to code/
│   └── README.md                Per-attribute documentation for every code change
│
└── flows/                       Human-readable UI documentation (reference only)
    ├── overview.md
    └── 00-home/ 01-select-model/ 02-quantize/ 03-convert/ ...
```

---

## How the fixture works

### Why `electron.launch` is not used

Playwright's `_electron.launch` injects `--remote-debugging-port=0` into the process argv and reads the assigned port from stdout. VSCode strips this flag from its own argv (since v1.72) because it conflicts with VS Code's built-in extension debugger. The result is a deterministic failure within ~2 seconds:

```
electronApplication.firstWindow: Target page, context or browser has been closed
```

### The actual launch sequence

```
base.ts                           webview.ts
────────────────────────────────  ──────────────────────────────────────────
1. seedProjectData()              1. waitForSelector('.monaco-workbench')
2. spawn(VSCode, [               2. poll for outer <iframe> up to 5s
     --remote-debugging-port=9222  3. if absent: open via command palette
     --user-data-dir=...              Ctrl+Shift+P → "HisparkAI: Welcome"
     WORKSPACE_PATH               4. frameLocator('iframe')
     --extensionDevelopmentPath      .frameLocator('iframe#active-frame')
     ...                          5. waitFor [data-testid="app-ready"]  ← 20s
   ])                             6. waitFor [data-testid="history-files-section"] ← 15s
3. waitForCDP(9222, 60s)          7. attach console/pageerror listeners
4. chromium.connectOverCDP()      → yield inner FrameLocator to test
5. contexts[0].pages()[0]
```

### Why `projectdata.json` must be pre-seeded

`extension.ts` reads `<USER_DATA_DIR>/User/globalStorage/projectdata.json` during activation. If no entry matches the opened workspace path, it overrides `target` to `'NONE'`, causing the extension to render `WelcomePage` (the project list) instead of the chip config panel — and `[data-testid="app-ready"]` never appears.

`base.ts` calls `seedProjectData()` before spawning VSCode. This writes a minimal entry so `isActiveProjectFound = true` and `target` stays `'CPU'`.

### The `--user-data-dir` profile

The dedicated profile at `e2e/.vscode-test-profile/` bypasses VSCode's single-instance lock. Without it, a second VSCode process with the same profile detects the running instance, forwards its args to it, and exits — leaving Playwright with a dead process. The profile persists across runs so first-run UX (welcome tabs, telemetry consent) only appears once.

---

## Troubleshooting

### `[globalSetup] Extension build output not found`

```bash
cd ../code && yarn compile
```

### `[globalSetup] WORKSPACE_PATH does not exist on disk`

Check that `WORKSPACE_PATH` in `.env` is the correct absolute path for your machine. The sentinel file must exist at `<WORKSPACE_PATH>/build/config/target_config/ws63/ws63.json`.

### `[globalSetup] Required test data not found`

Check that `DATA_DIR` in `.env` points to the `data/` directory in this repository, and that `data/cali/`, `data/vali/`, and `data/label.csv` all exist inside it.

### `CDP endpoint did not become available within 60000ms`

VSCode failed to start or is taking unusually long. Check:

1. `VSCODE_EXECUTABLE_PATH` is the correct binary for your platform (not a shell wrapper).
2. Nothing else is using port 9222: `netstat -an | findstr 9222` (Windows) or `lsof -i :9222` (macOS/Linux).
3. The sentinel file exists at the expected path under `WORKSPACE_PATH`.

If port 9222 is in use by another service, change `CDP_PORT` in `fixtures/base.ts` to a free port (e.g. `9223`).

### `[data-testid="app-ready"]` times out — WelcomePage appears instead of chip config

The extension opened with `target='NONE'`. Cause: the path in `projectdata.json` does not match what VSCode reports for the opened workspace.

On Windows, VSCode lowercases the drive letter. Temporarily add this to `base.ts` to print the normalised value and compare it against the title bar:

```typescript
console.log('seeding with:', normaliseWorkspacePath(WORKSPACE_PATH));
```

### History Files section is empty after fixture setup

TC-01 through TC-08 require at least one model to exist in History Files. This is a one-time manual step:

1. Open the extension in a normal VSCode session (not a test session).
2. Open the same `WORKSPACE_PATH` workspace.
3. Click **Import Model** on the Select Model page and import any `.onnx` or `.tflite` file.
4. The history entry is stored in the workspace and will be visible in all subsequent test runs.

### Test times out waiting for a history row after quantize/convert

The backend toolchain is not installed or failed silently. Check the VSCode Output panel (`HiSpark Studio AI` channel) for errors. TC-03 through TC-05 and TC-07–TC-08 require the full HiSpark toolchain.

---

## Test artifacts

On failure, Playwright saves artifacts to `test-results/` (git-ignored):

| Artifact | Saved when | How to view |
|---|---|---|
| Screenshot (PNG) | Every failure | Open directly |
| Video (`.webm`) | Every failure | Open with any video player |
| Trace (`.zip`) | Every failure | `npx playwright show-trace test-results/<folder>/trace.zip` |
| HTML report | Every run | `npx playwright show-report test-results` |

The trace viewer is the most useful tool for fixture-level failures — it shows a timeline of every action, a screenshot at each step, network requests, and the full call stack.
