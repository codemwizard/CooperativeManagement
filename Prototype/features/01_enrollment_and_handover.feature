@phase2 @area-ENR
Feature: Cooperative enrolment and handover
  A cooperative is registered on Symphony by a placeholder initiator (self-enroller) or by a platform
  enroller acting as the cooperative's proxy. Authority passes to institutionally recognised officers.

  Background:
    Given the platform is in test-data mode
    And the stage of every new organisation is "S0 Enrolment"

  @REQ-ENR-001 @REQ-ID-001 @BDD-ENR-001 @hard @wip
  Scenario: Workspace creation requires the registration certificate details
    When a self-enroller tries to create a workspace without the certificate document
    Then the command is rejected with reason "CERTIFICATE_DETAILS_REQUIRED"
    When the self-enroller creates a workspace with registered name, registered address, date of registration and the certificate document
    Then the workspace exists in state "workspace_created"
    And the certificate details have standing "asserted" with basis "Self-declared"
    And a missing registration number is recorded as "not printed on certificate", not as an error

  @REQ-ENR-006 @BDD-ENR-002 @hard @wip
  Scenario: The self-enroller is limited to three acts
    Given a self-enroller has created a workspace
    When the self-enroller tries to "AdmitEvidence"
    Then the command is rejected with reason "NOT_PERMITTED_FOR_INITIATOR"
    When the self-enroller tries to "RecordAppointment"
    Then the command is rejected with reason "NOT_PERMITTED_FOR_INITIATOR"
    When the self-enroller tries to "ApproveMinutes"
    Then the command is rejected with reason "NOT_PERMITTED_FOR_INITIATOR"

  @REQ-ENR-006 @REQ-ENR-010 @BDD-ENR-003 @hard
  Scenario: The self-enroller may create only Chairperson, Vice-Chairperson or Secretary accounts
    Given a self-enroller has created a workspace
    When the self-enroller creates an account with role "secretary" and a temporary password
    Then the account exists with status "temporary_credential"
    When the self-enroller creates an account with role "treasurer" and a temporary password
    Then the command is rejected with reason "ROLE_NOT_ALLOWED_FOR_INITIATOR"

  @REQ-ENR-010 @BDD-ENR-004 @hard
  Scenario: Temporary credentials are single use, expire and force a change
    Given a Secretary account with a temporary password created 73 hours ago
    When the Secretary logs in with the temporary password
    Then login is rejected with reason "TEMPORARY_CREDENTIAL_EXPIRED"
    Given a Secretary account with a fresh temporary password
    When the Secretary logs in with the temporary password
    Then the Secretary must change the password before any other action
    And an authentication event "first_login" is recorded
    And the temporary password cannot be used again
    And no password value appears in any event or log

  @REQ-ENR-006 @REQ-ENR-005 @BDD-ENR-005 @hard @wip
  Scenario: Handover closes the initiator account and preserves provenance
    Given a self-enroller created the workspace and a Secretary account
    And the Secretary has logged in and accepted the handover
    Then the self-enroller account is closed
    And the certificate details still show origin "self_enroller" and creator "initiator"
    And the handover record lists the initiator, the incoming official and the unresolved claims

  @REQ-ENR-006 @BDD-ENR-006 @wip
  Scenario: The first official admits the certificate details
    Given the Secretary has logged in for the first time
    When the Secretary admits the certificate details
    Then the evidence shows "Admitted to register by Secretary"
    And the level remains "asserted"

  @REQ-ENR-009 @BDD-ENR-007 @gate @wip
  Scenario: Activation requires accepted authority and a platform check of the certificate
    Given an organisation in state "handover_accepted"
    And policy "activation_requires_platform_check" is on
    When the organisation is activated
    Then the command is rejected with reason "CERTIFICATE_NOT_PLATFORM_CHECKED"
    When an enroller records a platform check of the certificate with scope "sighted original; number matches copy"
    And the organisation is activated
    Then the organisation is in state "active"
    And the platform check does not claim registry validation

  @REQ-ENR-009 @BDD-ENR-008 @gate @SC-001 @wip
  Scenario: Activation without any accepted cooperative authority is rejected
    Given an organisation whose certificate has a platform check
    And no cooperative official has accepted authority
    When the organisation is activated
    Then the command is rejected with reason "NO_ACCEPTED_AUTHORITY"

  @REQ-ENR-002 @BDD-ENR-009 @hard @wip
  Scenario: Only provisioned and assigned enrollers may enrol an organisation
    Given an enroller who is not assigned to the organisation's cohort
    When the enroller starts an enrolment session for the organisation
    Then the command is rejected with reason "ENROLLER_NOT_ASSIGNED"

  @REQ-ENR-003 @BDD-ENR-010 @hard @wip
  Scenario: Assisted writes require a session with the representative present
    Given an assigned enroller and no open enrolment session
    When the enroller records the member register as the cooperative's proxy
    Then the command is rejected with reason "NO_ENROLMENT_SESSION"
    When the enroller starts a session recording the representative present, NRC sighted and consent to act
    And the enroller records the member register as the cooperative's proxy
    Then the entry has origin "platform_enroller_proxy" and standing "supported"

  @REQ-ENR-004 @BDD-ENR-011 @wip
  Scenario Outline: Identity-check method is configuration and proves only that the check happened
    Given identity check method "<method>" is enabled
    When the enroller records an identity check by "<method>" for the representative
    Then an authentication event records method "<method>" and actor
    And no cooperative fact becomes verified because of that event

    Examples:
      | method               |
      | otp                  |
      | in_person_attested   |
      | document_sighted     |

  @REQ-ENR-007 @BDD-ENR-012 @wip
  Scenario: Stages are resumable and later facts may be recorded early
    Given an organisation in state "identity_in_progress"
    When the official records the next meeting date before by-laws are entered
    Then the fact is saved
    And a finding shows "By-laws not yet recorded" as a dependency
    And the Setup Path allows opening any step

  @REQ-ENR-008 @BDD-ENR-013 @hard @SC-016 @wip
  Scenario: A command replayed after being captured offline is applied once
    Given an enrolment command captured offline with command id "c-100" and occurred_at three days ago
    When the command is submitted twice
    Then it is applied once
    And the stored occurred_at is the captured time
    And the second response returns the original result

  @REQ-ENR-011 @BDD-ENR-014 @policy @advisory @wip
  Scenario: Proxy entry and platform check by the same enroller is disclosed, not hidden
    Given an enroller entered the certificate details as proxy
    When the same enroller records a platform check of those details
    Then the platform check is recorded
    And the standing shows flag "proxy entry and platform check by the same person"
    When policy "require_distinct_reviewer" is on
    And the same enroller records a platform check
    Then the command is rejected with reason "DISTINCT_REVIEWER_REQUIRED"
