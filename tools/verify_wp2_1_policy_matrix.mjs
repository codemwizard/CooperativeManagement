import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const unique = (values) => new Set(values).size === values.length;

export function validateMatrix(matrix) {
  const errors = [];

if (matrix.contract !== 'phase1-authorization-policy-matrix-v2' || matrix.status !== 'frozen') {
  errors.push('matrix must declare the frozen v2 contract');
}
if (matrix.owner_ruling?.id !== 'D-19' || !matrix.owner_ruling.date) {
  errors.push('owner ruling D-19 with date is required');
}

const actorIds = matrix.actor_classes?.map((actor) => actor.id) ?? [];
const actionIds = matrix.actions?.map((action) => action.id) ?? [];
if (actorIds.length === 0 || !unique(actorIds)) errors.push('actor classes must be non-empty and unique');
if (actionIds.length === 0 || !unique(actionIds)) errors.push('action IDs must be non-empty and unique');
if (!unique(matrix.capacity_types ?? [])) errors.push('capacity types must be unique');

const requiredActorClasses = [
  'platform_admin', 'platform_enroller', 'self_enroller', 'chairperson', 'vice_chairperson',
  'secretary', 'treasurer', 'director', 'committee_chair', 'committee_member', 'member',
  'internal_verifier', 'field_agent', 'delegate', 'acting_officer', 'programme_manager',
  'ta', 'pfi_analyst', 'pfi_credit', 'fund_manager', 'external_verifier', 'union_ta',
];
for (const id of requiredActorClasses) if (!actorIds.includes(id)) errors.push(`missing required actor class: ${id}`);

const requiredActions = ['capacity.grant', 'capacity.revoke', 'ta_scope.grant', 'ta_scope.revoke'];
for (const id of requiredActions) if (!actionIds.includes(id)) errors.push(`missing required action: ${id}`);

const requiredDimensions = [
  'unknown_action_denies',
  'malformed_or_unknown_parameter_denies',
  'missing_or_contradictory_authority_denies',
  'tenant_mismatch_denies',
  'same_tenant_wrong_organization_denies',
  'wrong_or_missing_cooperative_scope_denies',
  'wrong_union_or_inactive_union_ta_assignment_denies',
  'authority_before_active_from_denies',
  'authority_at_active_from_allows_when_other_conditions_pass',
  'authority_before_active_to_allows_when_other_conditions_pass',
  'authority_at_active_to_denies',
  'revoked_authority_denies_after_effective_time',
  'institutional_read_only_precedence_denies',
  'invalid_grant_interval_denies',
  'assisted_enroller_requires_active_session_presence_and_recorded_decision',
];
const dimensions = matrix.required_boundary_dimensions ?? [];
if (!unique(dimensions)) errors.push('required boundary dimensions must be unique');
for (const id of requiredDimensions) if (!dimensions.includes(id)) errors.push(`missing boundary dimension: ${id}`);

for (const action of matrix.actions ?? []) {
  const allow = action.allowed_actor_classes ?? [];
  const conditional = Object.keys(action.conditional_actor_classes ?? {});
  const deny = action.denied_actor_classes ?? [];
  const partition = [...allow, ...conditional, ...deny];
  if (!unique(partition)) errors.push(`${action.id}: duplicate actor-class decision row`);
  for (const id of partition) if (!actorIds.includes(id)) errors.push(`${action.id}: unknown actor class ${id}`);
  for (const id of actorIds) if (!partition.includes(id)) errors.push(`${action.id}: missing decision row for ${id}`);
  if (!Array.isArray(action.parameters) || action.parameters.length === 0 || !unique(action.parameters)) {
    errors.push(`${action.id}: parameters must be a non-empty unique list`);
  }
  if (!Array.isArray(action.source_refs) || action.source_refs.length === 0) {
    errors.push(`${action.id}: at least one source reference is required`);
  }
  for (const ref of action.source_refs ?? []) {
  if (!Object.values(matrix.sources ?? {}).includes(ref) && ref !== 'D-17' && ref !== 'D-19' && ref !== 'IFV-3' && ref !== 'INV-001' && ref !== 'INV-024' && ref !== 'REQ-AUD-008' && ref !== 'ADR-020' && ref !== 'O-6') {
      errors.push(`${action.id}: unrecognized source reference ${ref}`);
    }
  }
}

  return errors;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const matrixPath = resolve(root, 'evidence/phase1/wp2.1/phase1-authorization-policy-matrix.json');
  const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
  const errors = validateMatrix(matrix);
  if (errors.length > 0) {
    process.stderr.write(`WP2.1 authorization matrix INVALID (${errors.length} issue(s))\n${errors.map((error) => `- ${error}`).join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`WP2.1 authorization matrix valid: ${matrix.actions.length} actions × ${matrix.actor_classes.length} actor classes; ${matrix.required_boundary_dimensions.length} required boundary dimensions.\n`);
  }
}
