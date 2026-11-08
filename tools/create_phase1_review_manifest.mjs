import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [candidateSha, outputArgument] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/i.test(candidateSha ?? '')) {
  console.error('Usage: node tools/create_phase1_review_manifest.mjs <full-candidate-commit-sha> [output-path]');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
if (head.toLowerCase() !== candidateSha.toLowerCase()) {
  console.error(`Candidate SHA mismatch: requested ${candidateSha}, checkout is ${head}`);
  process.exit(2);
}
const dirty = git('status', '--porcelain');
if (dirty) {
  console.error('Refusing to create candidate evidence from a dirty worktree.');
  process.exit(2);
}

const indexPath = 'evidence/phase1/review-document-index.json';
const indexBytes = readFileSync(path.join(root, indexPath));
const index = JSON.parse(indexBytes.toString('utf8'));
const indexedPaths = [...new Set((index.documents ?? []).map((row) => row.path))].sort();
if (!indexedPaths.length) throw new Error('Review index contains no document paths.');

const hashPath = (relativePath, role) => {
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error(`Unsafe indexed path: ${relativePath}`);
  }
  const absolutePath = path.join(root, relativePath);
  const bytes = readFileSync(absolutePath);
  return {
    path: relativePath,
    role,
    bytes: statSync(absolutePath).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};
const files = indexedPaths.map((relativePath) => hashPath(
  relativePath,
  index.documents.find((row) => row.path === relativePath).role,
));
const parent = git('rev-parse', `${head}^1`);
const changedPaths = git('diff', '--name-only', parent, head).split(/\r?\n/).filter(Boolean).sort();
const implementationDiffFiles = changedPaths.map((relativePath) => hashPath(relativePath, 'Changed by the reviewed candidate commit; inspect diff and relevant surrounding code/tests.'));

const outputPath = outputArgument
  ? path.resolve(root, outputArgument)
  : path.join(root, 'evidence', 'phase1', 'reviews', head.slice(0, 12), 'sha256-manifest.json');
const reviewsRoot = path.join(root, 'evidence', 'phase1', 'reviews');
const relativeOutput = path.relative(reviewsRoot, outputPath);
if (relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput)) {
  throw new Error('Output must remain under evidence/phase1/reviews/.');
}
const manifest = {
  format: 'phase1-review-sha256-manifest-v1',
  candidate_commit: head,
  clean_worktree: true,
  review_index: indexPath,
  review_index_sha256: createHash('sha256').update(indexBytes).digest('hex'),
  files,
  implementation_diff_files: implementationDiffFiles,
};
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(`Wrote ${path.relative(root, outputPath)} for ${head} (${files.length} indexed files).`);
