export function parseJsonRejectingDuplicateKeys(source: string): unknown;
export function canonicalizeJcs(value: unknown): string;
export function semanticEnvelope(command: Record<string, unknown>): Record<string, unknown>;
export function commandDigest(command: Record<string, unknown>, key: string | Uint8Array): string;
export function digestForReceipt(
  command: Record<string, unknown>,
  keyVersion: string,
  historicalKeys: Record<string, string | Uint8Array>,
): string;
export function resolveReceiptAttempts(attempts: Array<Record<string, unknown>>, key: string | Uint8Array): string[];
export function decideReconciliationAccess(input: Record<string, unknown>): {
  outcome: string;
  audit_required?: boolean;
};
export function correctedCommandUsesFreshId(originalCommandId: string, correctedCommandId: unknown): boolean;
export function validateAndMaterializeCommandPayload(payload: unknown, schema: unknown): Record<string, unknown>;
export function resolveCommandContractVersions(receipt: Record<string, unknown>, available: Record<string, unknown>): {
  schema_version: unknown;
  canonicalization_version: unknown;
};
export function checkPurgePreflight(input: Record<string, any>): {
  allowed: boolean;
  errors: string[];
  destructiveSqlMayRun: boolean;
};
export function authorizeDemoMutation(input: Record<string, unknown>): { allowed: boolean; reason: string };
export function sessionValidity(input: Record<string, any>): { valid: boolean; reason: string };
export function reconciliationExpiryDisposition(input: Record<string, string>): {
  action: string;
  payloadAccessible: boolean;
};
export function forcedChangeRouteAllowed(method: string, pathname: string): boolean;
export function validateUnsafeSessionRequest(input: Record<string, string | undefined>): {
  allowed: boolean;
  reason: string;
};
export function receiptReplayVisibility(input: Record<string, unknown>): { visible: boolean; replayable: boolean };
export function isSafeReceiptResult(result: unknown, allowedFields?: string[]): boolean;
export function authorityRaceOutcome(input: Record<string, unknown>): { command: string; change: string };
export function resolveUncertainCommandCommit(input: Record<string, unknown>): string;
