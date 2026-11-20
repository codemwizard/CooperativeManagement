import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const sourcePath = 'evidence/phase1/wp5.2/blocklist/100k-most-used-passwords-NCSC.txt';
const outputPath = 'packages/domain/src/identity/password-blocklist-v1.json';
const manifestPath = 'evidence/phase1/wp5.2/blocklist/manifest.json';
const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase();
const [source, outputBytes, manifestBytes] = await Promise.all([
  readFile(sourcePath),
  readFile(outputPath),
  readFile(manifestPath),
]);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const output = JSON.parse(outputBytes.toString('utf8'));
const expectedSourceCommit = '6b19c2f5088c45b5dadb4d8918d2ab4f7efb03a9';
const expectedSourcePath = 'Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt';
const decoded = new TextDecoder('utf-8', { fatal: true }).decode(source);
const sourceEntries = decoded
  .replace(/^\uFEFF/, '')
  .split('\n')
  .map((entry) => entry.replace(/\r$/, ''))
  .filter((entry) => entry.length > 0);
const regenerated = [...new Set(sourceEntries.map((entry) => entry.toLowerCase()))]
  .sort();

assert.equal(manifest.version, 'phase1-ncsc-top100k-v1');
assert.equal(manifest.source.commit, expectedSourceCommit);
assert.equal(manifest.source.path, expectedSourcePath);
assert.equal(manifest.source.url, `https://github.com/danielmiessler/SecLists/blob/${expectedSourceCommit}/${expectedSourcePath}`);
assert.equal(manifest.source.sourceSha256, sha256(source));
assert.equal(manifest.output.path, outputPath);
assert.equal(manifest.output.sha256, sha256(outputBytes));
assert.equal(manifest.entryCount, output.length);
assert.equal(manifest.source.nonEmptySourceEntryCount, sourceEntries.length);
assert.deepEqual(output, regenerated);
assert.equal(new Set(output).size, output.length);
assert.ok(output.includes('password12345'));

console.log(`PASS ${manifest.version}: ${output.length} normalized entries; source SHA-256 ${sha256(source)}; generated data SHA-256 ${sha256(outputBytes)}.`);
