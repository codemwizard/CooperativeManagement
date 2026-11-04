@phase1 @area-AUD
Feature: Commands, audit trail and integrity
  Every write is a command that commits state, event and outbox atomically, is idempotent,
  detects stale writes, isolates tenants and never trusts the client for standing or authority.

  Background:
    Given two organisations "Org A" and "Org B"
    And an authenticated Secretary in "Org A"

  @REQ-AUD-001 @BDD-AUD-001 @hard @SC-018
  Scenario: State, event and outbox commit together or not at all
    When a command fails after the state change but before the outbox write
    Then no state change persists
    And no event persists
    And no outbox row persists

  @REQ-AUD-002 @BDD-AUD-002 @hard @SC-016
  Scenario: The same command id with the same payload returns the original result
    Given a command with id "c-1" has been applied
    When the same command is submitted again
    Then the result equals the first result
    And no second event is written

  @REQ-AUD-002 @BDD-AUD-003 @hard @SC-016
  Scenario: The same command id with a different payload is rejected
    Given a command with id "c-1" has been applied
    When a command with id "c-1" and a different payload is submitted
    Then it is rejected with reason "IDEMPOTENCY_KEY_REUSED"

  @REQ-AUD-003 @BDD-AUD-004 @hard @SC-017
  Scenario: A stale expected version is rejected and both inputs are preserved
    Given the member register is at version 5
    When two officers submit edits both expecting version 5
    Then the first edit is applied
    And the second is rejected with reason "VERSION_CONFLICT"
    And the rejected input is stored for reconciliation

  @REQ-AUD-004 @BDD-AUD-005 @hard @SC-015
  Scenario: A command cannot touch another organisation
    When the Secretary in "Org A" sends a command targeting an evidence item in "Org B"
    Then it is rejected with reason "NOT_AUTHORISED_FOR_ORGANISATION"
    And nothing in "Org B" changes
    And the attempt is audited

  @REQ-AUD-004 @BDD-AUD-006 @hard
  Scenario: Cross-organisation reads return nothing
    When the Secretary in "Org A" requests an item identifier from "Org B"
    Then the response is "not found"

  @REQ-AUD-005 @BDD-AUD-007 @hard
  Scenario: UI telemetry is not the business audit log
    When the user clicks around the workspace with telemetry enabled
    Then the domain event store contains no UI interaction events
    And the telemetry stream contains no personal data

  @REQ-AUD-006 @BDD-AUD-008 @hard @SC-019
  Scenario Outline: Read-only institutions cannot mutate cooperative source records
    Given a "<role>" with read-only scope on "Org A"
    When they send "<command>"
    Then it is rejected with reason "READ_ONLY_ROLE"

    Examples:
      | role          | command            |
      | pfi_analyst   | AmendClaim         |
      | union_ta      | AdmitEvidence      |
      | fund_manager  | ApproveMinutes     |
      | ta            | RecordTaCompletion |

  @REQ-AUD-006 @BDD-AUD-009 @hard @INV-021
  Scenario: The client cannot set verified, authority or approval states
    When a client submits a payload containing "status": "approved_official"
    Then the field is ignored or the command is rejected
    And standing is recomputed from events only

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

  @REQ-AUD-002 @BDD-AUD-014 @hard
  Scenario: Authorisation is enforced on the server for every command
    When a command is sent with a forged role header
    Then the server uses the stored user, capacities and appointments
    And the forged header has no effect

  @REQ-ENR-008 @BDD-AUD-015 @hard
  Scenario: Events keep occurred_at separate from recorded_at
    Given a command captured offline two days ago and synced now
    Then the event shows occurred_at two days ago and recorded_at now
    And ordering of events within the aggregate follows the aggregate version

  @REQ-AUD-001 @BDD-AUD-016
  Scenario: Validation runs are immutable
    Given a validation run recorded against rule version 3
    When the rule is updated to version 4
    Then the earlier run is unchanged
    And a new run records rule version 4
