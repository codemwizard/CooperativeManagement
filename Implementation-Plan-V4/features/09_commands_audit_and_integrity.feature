@phase1 @area-AUD
Feature: Commands, audit trail and integrity
  Every write is a command that commits state, event and outbox atomically, is idempotent,
  detects stale writes, isolates tenants and never trusts the client for standing or authority.

  Background:
    Given two organisations "Org A" and "Org B" in separate tenants
    And an authenticated Secretary in "Org A"

  @REQ-AUD-001 @BDD-AUD-001 @hard @SC-018
  Scenario: State, event and outbox commit together or not at all
    When a command fails after the state change but before the outbox write
    Then no state change persists
    And no event persists
    And no outbox row persists

  @REQ-AUD-002 @BDD-AUD-002 @hard @SC-016 @wp16-live
  Scenario: The same command id with the same payload returns the original result
    Given a persisted Chairperson session in "Org A"
    And a registered GrantCapacity command has been applied
    When the same registered command is submitted again
    Then the HTTP result is a replay of the original command result
    And no additional event is written for the replay

  @REQ-AUD-002 @BDD-AUD-003 @hard @SC-016 @wp16-live
  Scenario: The same command id with a different payload is rejected
    Given a persisted Chairperson session in "Org A"
    And a registered GrantCapacity command has been applied
    When a registered command reuses the id with a different payload
    Then the HTTP command result is "IDEMPOTENCY_KEY_REUSED"

  @REQ-AUD-003 @BDD-AUD-004 @hard @SC-017
  Scenario: A stale expected version is rejected and both inputs are preserved
    Given the member register is at version 5
    When two officers submit edits both expecting version 5
    Then the first edit is applied
    And the second is rejected with reason "VERSION_CONFLICT"
    And the rejected input is stored for reconciliation

  @REQ-AUD-004 @BDD-AUD-005 @hard @SC-015 @wp16-live
  Scenario: A command cannot touch another organisation
    When the Secretary in "Org A" submits GrantCapacity for "Org B"
    Then the HTTP command result is "NOT_AUTHORIZED"
    And nothing in "Org B" changes
    And the tenant mismatch is recorded in the security-attempt audit

  @REQ-AUD-004 @BDD-AUD-006 @hard
  Scenario: Cross-organisation reads return nothing
    When the Secretary in "Org A" requests an item identifier from "Org B"
    Then the response is "not found"

  @REQ-AUD-005 @BDD-AUD-007 @hard
  Scenario: UI telemetry is not the business audit log
    When the user clicks around the workspace with telemetry enabled
    Then the domain event store contains no UI interaction events
    And the telemetry stream contains no personal data

  @REQ-AUD-006 @BDD-AUD-008 @hard @SC-019 @wp16-live
  Scenario Outline: Read-only institutions cannot mutate cooperative source records
    Given a "<role>" with read-only scope on "Org A"
    When they submit the registered "GrantCapacity" command
    Then the HTTP command result is "NOT_AUTHORIZED"

    Examples:
      | role         |
      | pfi_analyst  |
      | union_ta     |
      | fund_manager |

  @REQ-AUD-006 @BDD-AUD-009 @hard @INV-021 @wp16-live
  Scenario: The client cannot set verified, authority or approval states
    Given a persisted Chairperson session in "Org A"
    When a client submits a registered command with injected "status": "approved_official"
    Then the client-supplied status is rejected by the command schema
    And the persisted capacity remains linked to its committed domain event

  @REQ-AUD-001 @BDD-AUD-010 @hard @INV-018
  Scenario: Events are append-only
    When an update or delete is attempted on a domain event
    Then the database rejects it

  @REQ-EVD-001 @BDD-AUD-011 @hard @INV-008
  Scenario: Evidence and minutes versions cannot be updated in place
    When an update is attempted on an evidence version row
    Then the database rejects it
    When an update is attempted on a minutes version row
    Then the database rejects it
    And approval and admission are stored in their own tables

  @REQ-EVD-004 @BDD-AUD-012 @hard
  Scenario: Only one open dispute per target
    Given an open dispute on an evidence version
    When another dispute is raised on the same version
    Then it is rejected with reason "DISPUTE_ALREADY_OPEN"

  @REQ-EVD-004 @BDD-AUD-013 @hard @INV-010
  Scenario: A finding must reference the version of its assignment
    Given an assignment for evidence version 2
    When a finding is recorded for version 1 against that assignment
    Then the database or command rejects it with reason "FINDING_VERSION_MISMATCH"

  @REQ-AUD-008 @BDD-AUD-014 @hard @wp16-live
  Scenario: Authorisation is enforced on the server for every command
    When a Secretary sends GrantCapacity with a forged platform-admin role header
    Then the same authenticated Secretary is denied without the forged header
    And no business command state was written

  @REQ-ENR-008 @BDD-AUD-015 @hard
  Scenario: Events keep occurred_at separate from recorded_at
    Given a command captured offline two days ago and synced now
    Then the event shows occurred_at two days ago and recorded_at now
    And ordering of events within the aggregate follows the aggregate version

  @phase6 @REQ-AUD-007 @BDD-AUD-016 @INV-017
  Scenario: Validation runs are immutable
    Given a validation run recorded against rule version 3
    When the rule is updated to version 4
    Then the earlier run is unchanged
    And a new run records rule version 4
