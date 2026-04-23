# Quantize Page — Variant Overview

## SDK × Method Matrix

| SDK | Method | UI | Status |
|-----|--------|----|--------|
| CPU | PTQ    | See `cpu-ptq.md` | ✅ documented |
| NPU | PTQ    | Different layout from CPU PTQ — see `npu-ptq.md` | ❌ not documented |
| NPU | QAT    | Different layout from NPU PTQ — see `npu-qat.md` | ❌ not documented |

CPU only supports PTQ. NPU supports both PTQ and QAT, selected via a mode toggle or tab on the page.

## Common Elements (All Variants)

- **"Model currently selected"** — shows the model carried from Select Model page
- **"Next Without Quantization"** button — skips quantization and goes directly to Convert
- **Quantize** button — starts the quantization process
- **Quantization Result History** table — appears below config; accumulates results across runs
- **Probability Density Histogram** — panel to the right of the history table; only populated in CPU PTQ mode 4 (with Validation Labels)

## Result History Behavior

- Results **accumulate** across test runs (state is persisted by the extension)
- Tests must not assert on absolute row counts — assert on the presence of the most recent row only
- Each row has: Trail ID, Model Name, Accuracy, Cosine Similarity, MSE, RAM(KB), Flash(KB), Operation (download, delete, Next)

## Detailed Flow Files

- [`cpu-ptq.md`](cpu-ptq.md) — CPU PTQ, all 4 execution modes ✅
- [`npu-ptq.md`](npu-ptq.md) — NPU PTQ ❌ stub, not documented yet
- [`npu-qat.md`](npu-qat.md) — NPU QAT ❌ stub, not documented yet
