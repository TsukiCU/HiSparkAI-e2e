# HiSpark Studio AI — Flow Overview

## Pipeline

```
Home → Select Model → Quantize → Convert → Deploy → Benchmark
```

- **Home** is the entry point (not a pipeline step)
- The 5 pipeline steps are shown in a top navbar; steps are sequential and state carries forward
- Deploy and Benchmark are **out of scope for now**

---

## Platform × SDK Matrix

| SDK  | Platform | Select Model | Quantize       | Convert         |
|------|----------|-------------|----------------|-----------------|
| CPU  | Windows  | ✅ documented | ✅ PTQ documented | ✅ documented  |
| CPU  | WSL      | same UI as Windows | same UI as Windows | same UI as Windows |
| CPU  | Linux    | same UI (import new model differs — see below) | same | same |
| NPU  | Windows  | same UI (different model formats) | ❌ not documented | ❌ not documented |
| NPU  | WSL      | same as NPU Windows | same | same |
| NPU  | Linux    | same (import new model differs) | same as NPU Windows | same |

**Key rules:**
- WSL and Windows share identical WebView UI for all pages — tests written for Windows run on WSL without change
- Linux shares the same WebView UI *except* for "Import New Model" (SSH-based, see 01-select-model)
- NPU and CPU have **different Quantize page layouts** and a minor Convert page difference

---

## Model Formats

| SDK | Accepted model formats |
|-----|----------------------|
| NPU | `.pt`, `.pth`, `.onnx` |
| CPU | `.onnx`, `.tflite` |

---

## Test Data

```
data/
├── cali/           ← calibration data (.npy files) — Quantize: Calibration Inputs
├── vali/           ← validation data (.npy files)  — Quantize: Validation Inputs
├── label.csv       ← labels file                   — Quantize: Validation Labels
└── backup/         ← backup copies, ignore in tests
```

The model file (mnist-12.onnx) is expected to be pre-imported into the extension's History Files before tests run. Tests do not import the model — they select it from history.

All file path inputs in the UI accept direct text entry. In tests, fill these paths directly without using file dialogs.

---

## Implementation Status

| Page | Variant | Status |
|------|---------|--------|
| Home | — | ✅ documented |
| Select Model | From history files | ✅ documented |
| Select Model | Import new model (Windows/WSL) | ❌ blocked — OS file dialog, not automatable |
| Select Model | Import new model (Linux) | ❌ blocked — SSH remote plugin, not automatable |
| Quantize | CPU PTQ | ✅ documented |
| Quantize | NPU PTQ | ❌ not documented |
| Quantize | NPU QAT | ❌ not documented |
| Convert | CPU | ✅ documented |
| Convert | NPU (extra input box) | ❌ not documented |
| Deploy | All | ❌ out of scope |
| Benchmark | All | ❌ out of scope |

---

## Directory Structure

```
flows/
├── overview.md              ← this file
├── 00-home/
│   ├── flow.md
│   └── images/
├── 01-select-model/
│   ├── flow.md
│   └── images/
├── 02-quantize/
│   ├── overview.md          ← NPU vs CPU variant map
│   ├── cpu-ptq.md           ✅
│   ├── npu-ptq.md           ❌ stub
│   ├── npu-qat.md           ❌ stub
│   └── images/
├── 03-convert/
│   ├── flow.md
│   └── images/
├── 04-deploy/
│   └── flow.md              ❌ stub
└── 05-benchmark/
    └── flow.md              ❌ stub
```
