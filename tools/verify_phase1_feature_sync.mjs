import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalDirectory = path.join(root, 'Implementation-Plan-V4', 'features');
const runnableDirectory = path.join(root, 'features');
const canonicalFiles = readdirSync(canonicalDirectory).filter((name) => name.endsWith('.feature')).sort();
const runnableFiles = readdirSync(runnableDirectory).filter((name) => name.endsWith('.feature')).sort();
const errors = [];

if (JSON.stringify(canonicalFiles) !== JSON.stringify(runnableFiles)) {
  errors.push('Canonical and runnable feature file inventories differ.');
}

function normalizedLines(filePath, { allowWip = false, allowBom = false } = {}) {
  let content = readFileSync(filePath, 'utf8');
  if (content.startsWith('\uFEFF')) {
    if (!allowBom) errors.push(`${path.relative(root, filePath)} has an unexpected UTF-8 BOM.`);
    content = content.slice(1);
  }
  if (!allowWip && /(^|\s)@wip(?=\s|$)/m.test(content)) {
    errors.push(`${path.relative(root, filePath)} uses @wip in the canonical feature source.`);
  }
  return content
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => (allowWip ? line.replace(/(^|\s)@wip(?=\s|$)/g, '$1') : line).replace(/[\t ]+$/g, ''));
}

for (const name of canonicalFiles) {
  const canonicalPath = path.join(canonicalDirectory, name);
  const runnablePath = path.join(runnableDirectory, name);
  try {
    const canonical = normalizedLines(canonicalPath);
    const runnable = normalizedLines(runnablePath, { allowWip: true, allowBom: true });
    const length = Math.max(canonical.length, runnable.length);
    const firstMismatch = Array.from({ length }, (_, index) => index)
      .find((index) => canonical[index] !== runnable[index]);
    if (firstMismatch !== undefined) {
      errors.push(`${name}:${firstMismatch + 1} canonical=${JSON.stringify(canonical[firstMismatch] ?? null)} runnable=${JSON.stringify(runnable[firstMismatch] ?? null)}`);
    }
  } catch (error) {
    errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`FAIL ${error}`);
  console.error('Runnable features may differ from canonical features only by @wip execution-status tags.');
  process.exitCode = 1;
} else {
  console.log(`PASS ${canonicalFiles.length} canonical/runnable Phase 1 feature pairs; only @wip status tags may differ.`);
}
