@phase3 @area-BYL
Feature: By-laws, precedence, legal catalogue and requirements
  The by-law of record prevails over resolutions. A conflicting resolution is held as a draft until
  the by-law is amended and re-submitted to the Registrar. Legal content is advisory, validated by
  the programme manager and routed to TA/Union. Symphony does not provide legal advice.

  Background:
    Given an active cooperative with a by-law version 1 of record
    And the precedence policy is "statute > by-law of record > resolution > default"
    And the release trigger is "registered_current"

  @REQ-BYL-001 @BDD-BYL-001 @hard @wip
  Scenario: By-law versions carry a status lifecycle
    When a new by-law amendment is drafted
    Then it has status "draft"
    When the general meeting adopts it
    Then it has status "adopted_pending_submission"
    When the Secretary records submission to the Registrar with evidence
    Then it has status "submitted_to_registrar"
    And version 1 is still the by-law of record until the release trigger is met

  @REQ-BYL-004 @BDD-BYL-002 @hard @wip
  Scenario: An adopted amendment is not operative until released
    Given amendment version 2 is "adopted_pending_submission"
    When requirements are evaluated
    Then they use version 1
    And a standing finding says "Amendment adopted but not submitted to the Registrar"

  @REQ-BYL-008 @BDD-BYL-003 @hard @SC-006 @wip
  Scenario: Registered-effective status needs registration evidence
    When the Secretary marks version 2 as "registered_effective" without registration evidence
    Then the command is rejected with reason "REGISTRATION_EVIDENCE_REQUIRED"

  @REQ-BYL-003 @REQ-GOV-008 @BDD-BYL-004 @hard @wip
  Scenario: A resolution contradicting the by-law of record is held as draft
    Given by-law version 1 says the Board has seven directors
    When a general meeting resolves that the Board has nine directors
    Then the resolution is recorded with status "held_draft"
    And finding "GOV-020" names the by-law clause and the resolution
    And the Board size used for evaluation remains seven

  @REQ-BYL-003 @REQ-GOV-008 @BDD-BYL-005 @hard @wip
  Scenario: A held resolution is released when the by-law amendment is registered
    Given a held resolution that depends on by-law amendment version 2
    When version 2 is recorded as submitted to the Registrar
    Then the resolution remains "held_draft"
    When the Registrar's Certificate of Amendment (Form 4) is recorded for version 2
    Then the resolution becomes "recorded"
    And the Board size used for evaluation becomes nine

  @REQ-BYL-003 @BDD-BYL-006 @wip
  Scenario: The release trigger can be relaxed to submission by configuration
    Given the release trigger is set to "submitted_to_registrar" for this organisation
    And a held resolution depends on version 2
    When version 2 is recorded as submitted to the Registrar
    Then the resolution becomes "recorded"
    And the legal status label still reads "Not yet effective: amendment not registered (Act s.20(2))"
    And finding "BYL-002 amendment pending registration" stays open

  @REQ-BYL-003 @BDD-BYL-007 @hard @wip
  Scenario: Statute is never overridden by a by-law or resolution
    Given a statutory catalogue rule marked "validated"
    When a by-law clause conflicts with it
    Then finding "BYL-conflict-with-statute" is raised
    And the statutory rule is still shown as the rule of reference

  @REQ-BYL-002 @BDD-BYL-008 @hard @wip
  Scenario: Extracted provisions are not operative until confirmed
    When the by-laws are imported and an AI-assisted extraction proposes 24 provisions
    Then all 24 have status "awaiting_confirmation"
    And requirements do not use them
    When the Chairperson confirms provision "quorum for general meetings"
    Then that provision is operative with approver recorded

  @REQ-BYL-002 @BDD-BYL-009 @wip
  Scenario: Interpretation of a provision is approved by Chairperson or Vice-Chairperson
    When the Treasurer tries to approve an interpretation of a provision
    Then the command is rejected with reason "NOT_AUTHORISED_TO_INTERPRET"
    When the Vice-Chairperson approves it
    Then the interpretation is recorded as approved

  @REQ-BYL-007 @BDD-BYL-010 @hard @wip
  Scenario: Meeting rules come from confirmed by-law provisions
    Given provision "quorum for general meetings is two thirds of members" is confirmed
    Then the meeting rule for "general meeting" has quorum fraction 2/3 with source clause

  @REQ-BYL-007 @BDD-BYL-011 @hard @wip
  Scenario: A missing rule is a finding, not a default
    Given no confirmed provision on notice period for special meetings
    When a special meeting is scheduled
    Then finding "BYL-003 rule unknown" is raised for "notice period"
    And the meeting is still recorded

  @REQ-BYL-006 @REQ-BYL-009 @BDD-BYL-012 @hard @wip
  Scenario: Unvalidated legal entries are guidance and never block
    Given a catalogue entry with status "needs_legal_validation"
    When a requirement derived from it is unmet
    Then the finding severity is at most "attention required"
    And it is not blocking
    And the entry is shown with "Symphony does not provide legal advice"

  @REQ-BYL-009 @BDD-BYL-013 @wip
  Scenario: The programme manager validates legal entries and routes advice to TA/Union
    Given the programme manager reviews a catalogue entry against the in-force instrument
    When the programme manager marks it "validated" with source, instrument version and date
    Then the entry shows "Validated by programme manager"
    And an advisory item is queued for the TA/Union of each affected cooperative

  @REQ-BYL-009 @BDD-BYL-014 @hard @wip
  Scenario: Only the programme manager role may validate legal entries
    When a Secretary tries to mark a legal entry "validated"
    Then the command is rejected with reason "NOT_AUTHORISED_FOR_LEGAL_VALIDATION"

  @REQ-BYL-009 @BDD-BYL-015 @wip
  Scenario: Every citation records which instrument and version it points to
    When a legal source is added
    Then it requires instrument name, version or date, and section reference
    And a source pointing to a repealed instrument is flagged "repealed instrument"

  @REQ-BYL-005 @BDD-BYL-016 @hard @wip
  Scenario: Requirement dimensions are stored separately
    Given requirement "Annual audit"
    When it is configured but has no implementation and no evidence
    Then configuration status is "configured"
    And implementation status is "not_started"
    And evidence status is "not_evidenced"
    And platform capability status is shown separately

  @REQ-BYL-005 @BDD-BYL-017 @wip
  Scenario: The cooperative's default requirements apply until the by-laws are known
    Given by-laws are not yet recorded
    Then default requirements from the statutory catalogue are shown as "default, awaiting by-laws"
    And each carries its source and validation status

  @REQ-BYL-003 @BDD-BYL-018 @wip
  Scenario Outline: Source type is set after by-laws are known
    Given an audit workflow requirement
    When the by-laws are confirmed and the requirement appears in "<source>"
    Then its source type is "<type>"

    Examples:
      | source                    | type           |
      | the by-laws only          | by-law         |
      | the validated statute     | statutory      |
      | neither                   | recommended    |

  @REQ-BYL-010 @BDD-BYL-019 @hard @wip
  Scenario Outline: Registrar forms are typed issued documents that drive findings
    When the Secretary records a "<form>" with its document
    Then the effect is "<effect>"

    Examples:
      | form                                        | effect                                                                   |
      | Form 2 certificate of registration          | registration evidence for the organisation                               |
      | Form 3 notice of refusal (amendment)        | amendment status "rejected"; finding with the 30-day appeal window       |
      | Form 4 certificate of amendment of by-laws  | amendment becomes registration-evidenced and eligible as registered_current |
      | Form 5 notice of cancellation               | finding "Registrar cancellation notice on file" with notice and appeal windows |

  @REQ-BYL-004 @REQ-BYL-011 @BDD-BYL-020 @hard @wip
  Scenario: Legal effect of an amendment is shown separately from the by-law of record
    Given amendment version 2 is "submitted_to_registrar" and not registered
    Then the legal status label reads "Not yet effective: amendment not registered (Act s.20(2))"
    And that label does not depend on the configured release trigger

  @REQ-BYL-011 @BDD-BYL-021 @hard @wip
  Scenario: Statutory seeds carry section, instrument and validation status
    When the statutory seeds from the Act are loaded
    Then each seed records section, instrument "Co-operative Societies Act, 1998 (No. 20 of 1998)" and status "text_checked"
    And seeds for sections not in the checked text carry status "needs_legal_validation"
    And no seed is shown as "validated" until the programme manager validates it

  @REQ-BYL-011 @REQ-MTG-007 @BDD-BYL-022 @policy @advisory @wip
  Scenario: A special resolution needs three quarters of those present and 21 clear days' written notice
    Given a meeting called with 14 days' written notice to pass a special resolution
    When 70 percent of members present vote in favour
    Then the resolution is recorded
    And finding "special resolution thresholds not met" lists notice 14 of 21 days and majority 70 of 75 percent

  @REQ-BYL-011 @BDD-BYL-024 @policy @advisory @wip
  Scenario: A by-law amendment needs two thirds of members present
    When a by-law amendment is voted with 60 percent of members present in favour
    Then the amendment is recorded as "not carried" with finding "two-thirds of members present not reached (Act s.20(1))"

  @REQ-ID-006 @BDD-BYL-023 @policy @advisory @wip
  Scenario Outline: The registered name is checked against the Act
    When the registered name "<name>" is recorded
    Then the result is "<result>"

    Examples:
      | name                                 | result                                  |
      | Nsenga Honey Growers Co-operative Limited | recorded, no finding               |
      | Nsenga Honey Growers Co-operative    | recorded, finding "name does not end with Limited" |

  @REQ-ID-006 @BDD-BYL-025 @policy @advisory @wip
  Scenario: Unions and federations may be exempt from the word co-operative
    Given a registered co-operative union named "Chipata Honey Union Limited"
    And the Registrar's exemption under section 78 is recorded
    Then no finding is raised about the word "co-operative"
    And the word "Limited" is still required

  @REQ-BYL-012 @BDD-BYL-026 @policy @advisory @wip
  Scenario: By-laws are checked against the Schedule's required provisions (s.19(1))
    Given the Schedule I list of required by-law provisions is loaded
    When by-laws are recorded with no provision on the dates of the financial year
    Then finding "required by-law provision missing: financial year dates (Schedule I)" is raised
    And the by-laws are still recorded

  @REQ-BYL-012 @BDD-BYL-027 @wip
  Scenario: Schedule I provisions drive requirements and rules
    Given a confirmed provision for "financial year dates"
    Then the annual audit, annual report to the Minister and annual general meeting due dates are derived from it
    And a confirmed provision for "composition of the board" and "term of office" feeds the governance profile

  @REQ-ID-007 @BDD-BYL-028 @hard @wip
  Scenario: A society registered under the repealed 1970 Act is deemed registered (s.85)
    When the certificate details are recorded with registration date 1986 under the repealed Act
    Then the registration is accepted as "deemed registered under the 1998 Act (s.85(2)(a))"
    And the certificate form may differ from Form 2
    And a finding asks whether the society re-constituted within the one-year transition (s.85(3))
