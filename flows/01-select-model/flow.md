# Select Model Page

## Layout

Top navbar shows **Select Model** as the active step (highlighted, with a checkmark after completion).

![Select Model page](images/select-model.png)

Two sections:

**Model Library** (top)
- **Import Model** button — imports a new model (see "Import New Model" below)
- Subtitle: "Click here to open a file browser. Supported file formats include .onnx, .tflite. Max file size: 256 MB"

**History Files** (bottom)
- Sortable list: Date / Name / Size
- Each entry shows: model icon, filename, file size, last modified date
- Each entry has: delete (trash) icon, **Next** button

## Accepted Model Formats

| SDK | Formats |
|-----|---------|
| CPU | `.onnx`, `.tflite` |
| NPU | `.pt`, `.pth`, `.onnx` |

## Path A — Select from History Files ✅ AUTOMATABLE

1. A model entry exists in History Files (e.g., `mnist-12.onnx`)
2. Click the **Next** button on that entry
3. Page transitions to Quantize, with the selected model shown in "Model currently selected"

This is the primary automated path. The model must already exist in history from a previous import.

## Path B — Import New Model ❌ NOT AUTOMATABLE

### Windows / WSL
Clicking **Import Model** opens an OS-native file dialog (not a browser `<input type="file">`).
The OS dialog cannot be driven by Playwright. This path is currently **blocked** for automation.

### Linux
Clicking **Import Model** triggers a remote connection via a proprietary SSH2-based plugin (a separate VSCode extension).
This involves SSH authentication and remote file browsing — not automatable with Playwright.

**Workaround for testing:** Ensure at least one model already exists in History Files before tests run (either pre-seeded by a prior manual import, or via a test setup step that mocks the model record in extension storage directly).

## Assertion Points

| Element | What to assert |
|---------|---------------|
| History Files list | At least one entry is visible before proceeding |
| Entry filename | Matches expected model name |
| "Model currently selected" on next page | Carries the correct filename after clicking Next |
