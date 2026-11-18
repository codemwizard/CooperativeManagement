import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateMatrix } from '../verify_wp2_1_policy_matrix.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const matrix = JSON.parse(await readFile(resolve(root, 'evidence/phase1/wp2.1/phase1-authorization-policy-matrix.json'), 'utf8'));

test('canonical matrix is exhaustive and source traced', () => {
  assert.deepEqual(validateMatrix(matrix), []);
});

test('missing, duplicated, unknown, or untraced actor decisions fail completeness', () => {
  const missing = structuredClone(matrix);
  missing.actions[0].denied_actor_classes.pop();
  assert.ok(validateMatrix(missing).some((error) => error.includes('missing decision row')));

  const duplicated = structuredClone(matrix);
  duplicated.actions[0].denied_actor_classes.push(duplicated.actions[0].allowed_actor_classes[0]);
  assert.ok(validateMatrix(duplicated).some((error) => error.includes('duplicate actor-class decision row')));

  const unknown = structuredClone(matrix);
  unknown.actions[0].denied_actor_classes[0] = 'unregistered_role';
  assert.ok(validateMatrix(unknown).some((error) => error.includes('unknown actor class')));

  const untraced = structuredClone(matrix);
  untraced.actions[0].source_refs = [];
  assert.ok(validateMatrix(untraced).some((error) => error.includes('at least one source reference')));
});

test('missing boundary dimensions fail completeness', () => {
  const incomplete = structuredClone(matrix);
  incomplete.required_boundary_dimensions = incomplete.required_boundary_dimensions.filter((dimension) => dimension !== 'authority_at_active_to_denies');
  assert.ok(validateMatrix(incomplete).some((error) => error.includes('missing boundary dimension')));
});
