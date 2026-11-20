import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('evidence/phase1/wp5.2/blocklist/100k-most-used-passwords-NCSC.txt');
const outputPath = path.resolve('packages/domain/src/identity/password-blocklist-v1.json');
const manifestPath = path.resolve('evidence/phase1/wp5.2/blocklist/manifest.json');
const sourceSha256 = 'C2E5696882C603B76BB67A47EE970897E5A76FC4C3F5547ABE3D0CA340C576E0';
const sourceCommit = '6b19c2f5088c45b5dadb4d8918d2ab4f7efb03a9';
const sourceUrl = `https://github.com/danielmiessler/SecLists/blob/${sourceCommit}/Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`;

const source = await readFile(sourcePath);
const actualSourceSha256 = createHash('sha256').update(source).digest('hex').toUpperCase();
if (actualSourceSha256 !== sourceSha256) {
  throw new Error(`Pinned source SHA-256 mismatch: expected ${sourceSha256}, received ${actualSourceSha256}`);
}

const decoded = new TextDecoder('utf-8', { fatal: true }).decode(source);
const sourceEntries = decoded
  .replace(/^\uFEFF/, '')
  .split('\n')
  .map((entry) => entry.replace(/\r$/, ''))
  .filter((entry) => entry.length > 0);
const entries = [...new Set(sourceEntries.map((entry) => entry.toLowerCase()))]
  .sort();
const output = `${JSON.stringify(entries)}\n`;
await writeFile(outputPath, output, 'utf8');
const outputSha256 = createHash('sha256').update(output, 'utf8').digest('hex').toUpperCase();

const manifest = {
  version: 'phase1-ncsc-top100k-v1',
  source: {
    project: 'danielmiessler/SecLists',
    commit: sourceCommit,
    path: 'Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt',
    url: sourceUrl,
    sourceSha256,
    nonEmptySourceEntryCount: sourceEntries.length,
    attribution: 'NCSC-derived most-used password list, vendored via SecLists; no runtime lookup.',
    licenseReference: `https://github.com/danielmiessler/SecLists/blob/${sourceCommit}/LICENSE`,
  },
  transformation: 'Decode strict UTF-8; remove an optional BOM; split on LF; remove one trailing CR; omit empty lines; lowercase entries; deduplicate; sort by Unicode code-unit order; encode as compact UTF-8 JSON plus LF.',
  entryCount: entries.length,
  output: {
    path: 'packages/domain/src/identity/password-blocklist-v1.json',
    sha256: outputSha256,
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ sourceSha256: actualSourceSha256, entryCount: entries.length, outputSha256, manifestPath: path.relative(process.cwd(), manifestPath) }, null, 2));
