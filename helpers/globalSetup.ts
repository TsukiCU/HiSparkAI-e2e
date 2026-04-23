import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default function globalSetup(): void {
  const extensionPath = process.env['EXTENSION_DEVELOPMENT_PATH'];

  if (!extensionPath) {
    throw new Error(
      '[globalSetup] EXTENSION_DEVELOPMENT_PATH is not set.\n' +
      'Copy e2e/.env.example to e2e/.env and fill in the required variables.'
    );
  }

  const extensionJs = path.resolve(extensionPath, 'dist', 'extension.js');
  if (!fs.existsSync(extensionJs)) {
    throw new Error(
      `[globalSetup] Extension build output not found at:\n  ${extensionJs}\n` +
      'Build the extension first by running: cd code && yarn compile'
    );
  }

  const vscodeExe = process.env['VSCODE_EXECUTABLE_PATH'];
  if (!vscodeExe) {
    throw new Error(
      '[globalSetup] VSCODE_EXECUTABLE_PATH is not set.\n' +
      'Copy e2e/.env.example to e2e/.env and fill in the required variables.'
    );
  }

  if (!fs.existsSync(vscodeExe)) {
    throw new Error(
      `[globalSetup] VSCode executable not found at:\n  ${vscodeExe}\n` +
      'Verify the VSCODE_EXECUTABLE_PATH in your .env file.'
    );
  }

  const dataDir = process.env['DATA_DIR'];
  if (!dataDir) {
    throw new Error(
      '[globalSetup] DATA_DIR is not set.\n' +
      'Copy e2e/.env.example to e2e/.env and fill in the required variables.'
    );
  }

  const requiredDataPaths = [
    path.resolve(dataDir, 'cali'),
    path.resolve(dataDir, 'vali'),
    path.resolve(dataDir, 'label.csv'),
  ];

  for (const p of requiredDataPaths) {
    if (!fs.existsSync(p)) {
      throw new Error(
        `[globalSetup] Required test data not found at:\n  ${p}\n` +
        'Ensure DATA_DIR points to the correct data/ directory in the repo.'
      );
    }
  }

  console.log('[globalSetup] All pre-flight checks passed.');
}
