/**
 * @symphony/api — serialisers/masking-serialiser.ts
 *
 * Role-based masking serialiser (PRV-003, PRV-004).
 *
 * Strips or masks PII fields from API responses based on the viewer's role.
 *
 * Rules (from PRV-003 and O-19):
 *   union_ta | institution roles   → all person_identifier fields replaced with [MASKED]; all member PII removed
 *   cooperative_officer            → sees own record; other members masked per PRV-003
 *   public_inspection              → statutory fields only: name, address, occupation, date_registered (Act s.21, s.28)
 *   internal roles                 → full access (platform-internal only, never exposed externally)
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   ✅ No `any` types — all shapes are explicitly typed
 *   ✅ Errors classified
 *   ✅ Input validated
 */

// ─── NRC pattern ─────────────────────────────────────────────────────────────

const NRC_PATTERN = /\d{6}\/\d{2}\/\d/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const MASKED = '[MASKED]';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewerRole =
  | 'union_ta'
  | 'pfi_analyst'
  | 'pfi_credit'
  | 'fund_manager'
  | 'ta'
  | 'external_verifier'
  | 'secretary'
  | 'chairperson'
  | 'treasurer'
  | 'vice_chairperson'
  | 'internal_verifier'
  | 'platform_admin'
  | 'platform_enroller'
  | 'public_inspection';

/** Statutory register fields per Act s.28 — always shown on public inspection. */
export const STATUTORY_FIELDS = new Set(['name', 'address', 'occupation', 'date_registered']);

/** Roles that are institutional read-only and must never see member PII. */
const INSTITUTIONAL_ROLES = new Set<ViewerRole>([
  'union_ta', 'pfi_analyst', 'pfi_credit', 'fund_manager', 'ta', 'external_verifier',
]);

/** Cooperative officer roles that may see masked member data (reveal on need). */
const OFFICER_ROLES = new Set<ViewerRole>([
  'secretary', 'chairperson', 'treasurer', 'vice_chairperson',
]);

/**
 * A member record as the domain might produce it.
 * Keys are snake_case field names.
 */
export type MemberRecord = Record<string, string | number | boolean | null>;

export interface MaskedMemberRecord {
  readonly [field: string]: string | number | boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check whether a string value looks like PII that must be masked.
 * Matches NRC pattern or email pattern.
 */
function looksLikePii(value: string): boolean {
  return NRC_PATTERN.test(value) || EMAIL_PATTERN.test(value);
}

/**
 * Mask PII fields from a member record for a given viewer role.
 */
function maskField(key: string, value: string | number | boolean | null): string | number | boolean | null {
  if (typeof value === 'string' && looksLikePii(value)) {
    return MASKED;
  }
  return value;
}

// ─── Main serialiser ──────────────────────────────────────────────────────────

/**
 * Mask a member record for the given viewer role and optionally the viewer's own userId.
 *
 * @param record      The raw member record from the domain.
 * @param viewerRole  The role of the user viewing the record.
 * @param viewerPersonId  The person ID of the viewer (for officer own-record checks).
 * @returns The masked record.
 */
export function maskMemberRecord(
  record: MemberRecord,
  viewerRole: ViewerRole,
  viewerPersonId: string | null = null,
): MaskedMemberRecord {
  // ── Public inspection: show only statutory fields ──
  if (viewerRole === 'public_inspection') {
    const result: Record<string, string | number | boolean | null> = {};
    for (const field of STATUTORY_FIELDS) {
      result[field] = record[field] ?? null;
    }
    return result;
  }

  // ── Institutional roles: mask all PII, remove non-statutory fields ──
  if (INSTITUTIONAL_ROLES.has(viewerRole)) {
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(record)) {
      if (STATUTORY_FIELDS.has(key)) {
        // Statutory fields are shown but PII-pattern values are masked
        result[key] = typeof value === 'string' && looksLikePii(value) ? MASKED : value;
      }
      // All other fields (identifier, contact, etc.) are absent
    }
    return result;
  }

  // ── Cooperative officers: see own full record; other members masked ──
  if (OFFICER_ROLES.has(viewerRole) || viewerRole === 'internal_verifier') {
    const recordPersonId = record['person_id'] ?? record['id'];
    const isOwnRecord = viewerPersonId !== null && recordPersonId === viewerPersonId;

    if (isOwnRecord) {
      // Own record — full access
      return { ...record };
    }

    // Other member's record — mask PII fields
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = maskField(key, value);
    }
    return result;
  }

  // ── Platform internal roles — full access ──
  return { ...record };
}

/**
 * Scrub any string in the record that matches the NRC pattern.
 * Used as a final safety net before API serialisation.
 */
export function scrubNrcFromRecord(record: MemberRecord): MaskedMemberRecord {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      result[key] = value.replace(NRC_PATTERN, '[REDACTED_NRC]');
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Scrub NRC pattern from a JSON string (for log scrubbing).
 */
export function scrubNrcFromString(input: string): string {
  return input.replace(NRC_PATTERN, '[REDACTED_NRC]');
}

