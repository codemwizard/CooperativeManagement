import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Resolve paths under the workspace app from any checkout location or OS. */
export function workspacePath(...parts: string[]): string {
  return path.join(repositoryRoot, 'apps', 'workspace', ...parts);
}
