import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , script, ...args] = process.argv;

if (!script) {
  console.error('Usage: node tools/run_python_tool.js <script.py> [...args]');
  process.exit(2);
}

const candidates = [
  process.env.PYTHON,
  process.env.USERPROFILE
    ? join(
        process.env.USERPROFILE,
        '.cache',
        'codex-runtimes',
        'codex-primary-runtime',
        'dependencies',
        'python',
        'python.exe',
      )
    : undefined,
  'python',
].filter(Boolean);

const python = candidates.find((candidate) => candidate !== 'python' && existsSync(candidate)) ?? 'python';
const result = spawnSync(python, [script, ...args], { stdio: 'inherit', shell: false });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
