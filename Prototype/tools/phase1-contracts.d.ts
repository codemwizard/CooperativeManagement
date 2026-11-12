export function validateEvidence(record: unknown, schema: unknown): string[];
export function validateDeferredFollowups(
  records: Array<Record<string, unknown>>,
  graph: { tasks?: Record<string, unknown> },
): string[];
export function validateDependencyGraph(
  graph: unknown,
  records: Record<string, unknown>,
  targetTask?: string,
  closureReadiness?: Record<string, unknown>,
): string[];
export function validatePhase1Gate(packageJson: unknown, repoRoot?: string): string[];
export function validatePhase1BddReport(report: unknown, manifest: unknown): string[];
export function validateBddOwnerMap(mapping: unknown, manifest: unknown, graph: unknown): string[];
export function validateRuntimeMode(matrix: unknown, config: unknown): string[];
export function validateTenantTableInventory(inventory: unknown, migrationTexts: string[]): string[];
export function validateTenantPolicyMatrix(matrix: unknown, inventory: unknown): string[];
export function validateAuthorityDependencyInventory(inventory: unknown, migrationInventory: unknown): string[];
export function validatePurgeTablePolicyMatrix(matrix: unknown, inventory: unknown): string[];
export {};
