import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const legacyPort = 5173;
const workspacePort = 5174;
const workspaceOnly = process.argv.includes('--workspace-only');
const playwrightArgs = process.argv.slice(2).filter((argument) => argument !== '--workspace-only');

const legacyServer = workspaceOnly ? undefined : await createServer({
  server: { host, port: legacyPort, strictPort: true },
});
const workspaceServer = await createServer({
  configFile: path.join(repoRoot, 'apps/workspace/vite.config.ts'),
  root: path.join(repoRoot, 'apps/workspace'),
  server: {
    host,
    port: workspacePort,
    strictPort: true,
  },
});

function runPlaywright() {
  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'test', ...playwrightArgs], {
      env: {
        ...process.env,
        SYMPHONY_E2E_EXTERNAL_SERVER: '1',
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

let exitCode = 1;
try {
  await legacyServer?.listen();
  await workspaceServer.listen();
  exitCode = await runPlaywright();
} finally {
  await workspaceServer.close();
  await legacyServer?.close();
}

process.exit(exitCode);
