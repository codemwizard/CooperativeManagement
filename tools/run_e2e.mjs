import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 5173;

const server = await createServer({
  server: {
    host,
    port,
    strictPort: true,
  },
});

function runPlaywright() {
  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'test'], {
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
  await server.listen(port);
  exitCode = await runPlaywright();
} finally {
  await server.close();
}

process.exit(exitCode);
