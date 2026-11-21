/**
 * @symphony/db — types/database.ts
 *
 * Kysely database type definitions for the symphony schema.
 * Only the tables used by the kernel Repository implementation are typed here.
 * Additional table types are added as each work package requires them.
 */

import type { Generated, Insertable, Selectable } from 'kysely';

// ─── aggregate_states ────────────────────────────────────────────────────────

export interface AggregateStateTable {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  version: Generated<number>;
  state: unknown; // JSONB — narrowed at the call site
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type AggregateStateRow = Selectable<AggregateStateTable>;
export type InsertAggregateState = Insertable<AggregateStateTable>;

// ─── domain_events ───────────────────────────────────────────────────────────

export interface DomainEventTable {
  id: string;
  tenant_id: string;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  payload: unknown; // JSONB
  occurred_at: Date;
  recorded_at: Generated<Date>;
  sequence: number;
}

export type DomainEventRow = Selectable<DomainEventTable>;
export type InsertDomainEvent = Insertable<DomainEventTable>;

// ─── event_outbox ─────────────────────────────────────────────────────────────

export interface EventOutboxTable {
  id: string;
  event_id: string;
  status: Generated<string>;
  created_at: Generated<Date>;
  delivered_at: Date | null;
}

export type EventOutboxRow = Selectable<EventOutboxTable>;
export type InsertEventOutbox = Insertable<EventOutboxTable>;

// ─── command_receipts ─────────────────────────────────────────────────────────

export interface CommandReceiptTable {
  command_id: string;
  tenant_id: string;
  actor_user_id: string;
  command_type: string;
  command_schema_version: string;
  canonicalization_version: string;
  digest_key_version: string;
  semantic_digest: Uint8Array;
  result_classification: 'committed_success' | 'terminal_rejection';
  result_schema_version: string;
  safe_result: unknown; // JSONB; validated against the registered result schema on read
  recorded_at: Generated<Date>;
}

export type CommandReceiptRow = Selectable<CommandReceiptTable>;
export type InsertCommandReceipt = Insertable<CommandReceiptTable>;

export interface SecurityAttemptTable {
  security_attempt_id: Generated<string>;
  tenant_id: string;
  actor_user_id: string;
  observed_command_id: string | null;
  observed_command_type: string | null;
  denial_code: 'AUTHORIZATION_DENIED' | 'NOT_AUTHORISED_FOR_ORGANISATION' | 'TENANT_MISMATCH' | 'READ_ONLY_ROLE';
  recorded_at: Generated<Date>;
}

export type SecurityAttemptRow = Selectable<SecurityAttemptTable>;

export interface ReconciliationInboxTable {
  reconciliation_id: string;
  tenant_id: string;
  payload_ciphertext: Uint8Array | null;
  encryption_key_ref: string | null;
  reason_code: 'VERSION_CONFLICT';
  lifecycle: 'open' | 'resolved' | 'superseded' | 'expired';
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  tombstoned_at: Date | null;
}

export type ReconciliationInboxRow = Selectable<ReconciliationInboxTable>;
export type InsertReconciliationInbox = Insertable<ReconciliationInboxTable>;

// ─── tenants ──────────────────────────────────────────────────────────────────

export interface TenantTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
}

export interface TemporaryCredentialTable {
  id: Generated<string>;
  tenant_id: string;
  user_id: string;
  secret_hash: string;
  issued_at: Generated<Date>;
  expires_at: Date;
  consumed_at: Date | null;
  revoked_at: Date | null;
}

export interface UserTable {
  id: string;
  tenant_id: string;
  status: string;
}
export interface PersonTable { id: string; tenant_id: string; pseudonym_id: string }
export interface OrganizationTable {
  id: string;
  tenant_id: string;
  status: string;
  organization_kind: 'cooperative' | 'union' | 'federation';
}
export interface UserRoleAssignmentTable {
  id: string;
  tenant_id: string;
  user_id: string;
  platform_role_id: string;
  granted_at: Date;
  revoked_at: Date | null;
}
export interface PlatformRoleTable { id: string; code: string }
export interface UserPersonLinkTable {
  tenant_id: string; user_id: string; person_id: string; linked_at: Date; unlinked_at: Date | null;
}
export interface OrganizationMembershipTable {
  tenant_id: string; organization_id: string; person_id: string; status: string;
  joined_at: Date; ended_at: Date | null;
}
export interface AppointmentTable {
  id: string; organization_id: string; person_id: string; position_id: string;
  started_at: Date; ended_at: Date | null; source_ref: string | null;
}
export interface PositionCatalogTable { id: string; code: string; active: boolean }
export interface CapacityGrantTable {
  id: string; user_id: string; organization_id: string; capacity_type: string;
  granted_by_user_id: string; granted_at: Generated<Date>; active_from: Date; expires_at: Date | null;
  revoked_at: Date | null; source_ref: string | null; source_event_id: string | null; revoked_event_id: string | null;
  assisted_session_id: string | null; representative_person_id: string | null; representative_decision: string | null;
}
export interface EnrolmentSessionTable {
  id: string; tenant_id: string; enroller_user_id: string; organization_id: string;
  representative_person_id: string | null; presence_attestation: unknown;
  representative_present: boolean; representative_nrc_sighted: boolean; representative_consented_to_act: boolean;
  attestation_recorded_by_user_id: string | null; attestation_recorded_at: Date | null;
  started_at: Date; closed_at: Date | null;
}
export interface ActingOfficerAppointmentTable {
  id: string; tenant_id: string; organization_id: string; person_id: string; appointment_kind: 'acting';
  position_code: string; appointed_by_user_id: string; recorded_by_user_id: string;
  source_kind: 'external_resolution' | 'external_delegation'; source_reference: string;
  source_issuing_body: string; source_date: string; supporting_evidence_version_id: string;
  effective_from: Date; effective_to: Date; supersedes_appointment_id: string | null;
  source_event_id: string | null; recorded_at: Generated<Date>;
}
export interface ActingOfficerAppointmentEndingTable {
  id: string; tenant_id: string; organization_id: string; appointment_id: string; ended_at: Date;
  ended_by_user_id: string; recorded_by_user_id: string;
  source_kind: 'external_resolution' | 'external_delegation'; source_reference: string;
  source_issuing_body: string; source_date: string; supporting_evidence_version_id: string;
  source_event_id: string; recorded_at: Generated<Date>;
}
export interface ProgrammeManagerScopeTable {
  id: string; tenant_id: string; programme_manager_user_id: string; target_organization_id: string;
  scope_kind: string; granted_at: Date; expires_at: Date | null; revoked_at: Date | null; source_ref: string;
}
export interface InstitutionalRoleAssignmentTable {
  id: string; tenant_id: string; user_id: string; institution_organization_id: string;
  role_code: string; granted_at: Date; expires_at: Date | null; revoked_at: Date | null;
}
export interface TaScopeDelegationTable {
  id: string; tenant_id: string; programme_manager_user_id: string; union_organization_id: string;
  delegatee_user_id: string; target_organization_id: string; granted_at: Generated<Date>; active_from: Date;
  expires_at: Date | null; revoked_at: Generated<Date | null>; agreement_ref: string;
  source_event_id: string | null; revoked_event_id: string | null;
}

export interface PasswordCredentialTable {
  id: Generated<string>;
  tenant_id: string;
  user_id: string;
  secret_hash: string;
  hash_version: Generated<string>;
  established_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// ─── Composite DB type ────────────────────────────────────────────────────────

export interface SymphonyDatabase {
  'symphony.aggregate_states': AggregateStateTable;
  'symphony.domain_events': DomainEventTable;
  'symphony.event_outbox': EventOutboxTable;
  'symphony.command_receipts': CommandReceiptTable;
  'symphony.security_attempts': SecurityAttemptTable;
  'symphony.reconciliation_inbox': ReconciliationInboxTable;
  'symphony.tenants': TenantTable;
  'symphony.temporary_credentials': TemporaryCredentialTable;
  'symphony.password_credentials': PasswordCredentialTable;
  'symphony.users': UserTable;
  'symphony.persons': PersonTable;
  'symphony.organizations': OrganizationTable;
  'symphony.user_role_assignments': UserRoleAssignmentTable;
  'symphony.platform_roles': PlatformRoleTable;
  'symphony.user_person_links': UserPersonLinkTable;
  'symphony.organization_memberships': OrganizationMembershipTable;
  'symphony.appointments': AppointmentTable;
  'symphony.position_catalog': PositionCatalogTable;
  'symphony.capacity_grants': CapacityGrantTable;
  'symphony.enrolment_sessions': EnrolmentSessionTable;
  'symphony.acting_officer_appointments': ActingOfficerAppointmentTable;
  'symphony.acting_officer_appointment_endings': ActingOfficerAppointmentEndingTable;
  'symphony.programme_manager_scopes': ProgrammeManagerScopeTable;
  'symphony.institutional_role_assignments': InstitutionalRoleAssignmentTable;
  'symphony.ta_scope_delegations': TaScopeDelegationTable;
}

