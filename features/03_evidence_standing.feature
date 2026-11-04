@phase2 @area-EVD
Feature: Evidence standing for claims
  Claims about members and assets rise from asserted to supported to verified only through
  named acts on an exact version. Standing is computed from the origin of the entry and is
  always read from a stated audience.

  Background:
    Given an active cooperative with a Secretary, a Chairperson, a Treasurer, a member "Mwila" and an internal verifier "Ndhlovu"

  @REQ-EVD-001 @REQ-EVD-011 @BDD-EVD-001 @hard @wip
  Scenario: A member's own entry is asserted
    When Mwila enters the claim "10 goats" on a personal phone
    Then the claim standing is "asserted" with basis "Self-declared by member"
    And the cooperative-side label is "Self-declared"

  @REQ-EVD-011 @BDD-EVD-002 @hard @wip
  Scenario: Supporting proof raises a claim to supported
    Given Mwila's claim "10 goats" is asserted
    When Mwila attaches a letter from the village headman stating ten goats
    Then the standing is "supported" with basis "Self-declared, with community-authority letter"

  @REQ-EVD-011 @BDD-EVD-003 @hard @wip
  Scenario: A support item that does not mention the claim does not qualify
    Given Mwila's claim "10 goats" is asserted
    When Mwila attaches a headman's letter about land boundaries only
    Then the standing remains "asserted"

  @REQ-EVD-003 @REQ-EVD-011 @BDD-EVD-004 @hard @SC-012 @wip
  Scenario: Admission changes the label, not the level
    Given Mwila's claim "10 goats" is supported
    When the Secretary admits the claim to the register
    Then the standing level remains "supported"
    And the label adds "Admitted to register by Secretary"

  @REQ-VER-002 @BDD-EVD-005 @hard @wip
  Scenario: Independent cooperative verification makes the claim verified
    Given Mwila's claim "10 goats" is supported
    When Ndhlovu counts the goats and records a finding "conformant" with scope "head-count on 12 October"
    Then the standing is "verified" with assurance class "cooperative_internal"
    And the finding names version 1 and scope "head-count on 12 October"

  @REQ-EVD-011 @BDD-EVD-006 @hard @wip
  Scenario Outline: The starting level depends on who entered the claim
    When "<entrant>" enters a claim with "<mode>"
    Then the standing is "<level>" with assurance "<assurance>"

    Examples:
      | entrant                  | mode                          | level     | assurance             |
      | member                   | own entry                     | asserted  | none                  |
      | secretary                | on member's behalf            | supported | none                  |
      | field agent              | transcribed statement         | supported | none                  |
      | field agent              | attested observation          | verified  | cooperative_internal  |
      | chairperson              | attested observation          | verified  | cooperative_internal  |
      | enroller                 | proxy entry in session        | supported | none                  |
      | ta programme officer     | programme record              | supported | none                  |

  @REQ-EVD-011 @BDD-EVD-007 @hard @wip
  Scenario: An observation attestation requires a statement of what was observed
    When a field agent enters a claim marked "observed" without saying what, how and when
    Then the standing is "supported" not "verified"
    And the entry shows "Observation not described"

  @REQ-EVD-001 @REQ-VER-004 @BDD-EVD-008 @hard @SC-009 @SC-011 @wip
  Scenario: Amending a claim creates a new version that resets standing
    Given Mwila's claim "10 goats" is verified on version 1
    When Mwila amends the claim to "12 goats"
    Then a version 2 exists and version 1 is unchanged
    And version 2 standing is "asserted"
    And the finding remains attached to version 1 only

  @REQ-VER-003 @BDD-EVD-009 @hard @SC-010 @wip
  Scenario: A supplier cannot verify their own claim
    Given Ndhlovu is also a member and entered the claim "5 beehives"
    When Ndhlovu records a finding on that claim
    Then the command is rejected with reason "SELF_VERIFICATION"

  @REQ-EVD-007 @BDD-EVD-010 @hard @wip
  Scenario: The client cannot assert a standing
    When a client sends a command with standing "verified" for an unverified claim
    Then the command is rejected with reason "STANDING_NOT_CLIENT_SETTABLE"

  @REQ-EVD-009 @BDD-EVD-011 @wip
  Scenario Outline: The same evidence reads differently for different audiences
    Given a claim whose standing is "<standing>"
    When it is viewed by "<audience>"
    Then the label is "<label>"

    Examples:
      | standing                         | audience     | label                                                                 |
      | verified cooperative_internal    | official     | Verified by our internal verifier                                     |
      | verified cooperative_internal    | institution  | Cooperative-verified, not independent; your own due diligence applies |
      | verified cooperative_internal    | independent  | Cooperative-verified; subject to independent verification            |
      | verified platform                | platform     | Platform-checked; counts toward Symphony readiness                    |
      | verified platform                | institution  | Platform-checked; you decide whether to accept it                     |
      | asserted                         | institution  | Self-declared, no supporting proof                                    |

  @REQ-VER-008 @BDD-EVD-012 @hard @wip
  Scenario: A destination can require an assurance class
    Given destination "Programme X" accepts assurance classes "platform, independent_external"
    And a claim verified with class "cooperative_internal"
    When the destination evaluates the claim
    Then the claim is shown as "not accepted by your policy"
    And it is not hidden

  @REQ-VER-008 @BDD-EVD-013 @wip
  Scenario: Legacy destinations accept any class so existing results do not change
    Given a legacy destination with no assurance policy
    When it evaluates a verified claim of any class
    Then the claim counts as verified

  @REQ-EVD-004 @BDD-EVD-014 @hard @SC-013 @wip
  Scenario: An open dispute blocks unqualified reliance
    Given a verified claim with an open dispute
    When an institution records reliance without referencing the dispute
    Then the command is rejected with reason "OPEN_DISPUTE"
    And the claim label shows "Disputed"

  @REQ-EVD-010 @BDD-EVD-015 @hard @wip
  Scenario Outline: Acts are available only in their pipeline stage
    Given an organisation in stage "<stage>"
    When a "<act>" is attempted
    Then the result is "<result>"

    Examples:
      | stage                        | act                     | result   |
      | S0 Enrolment                 | institutional finding   | rejected |
      | S1 Cooperative operations    | internal verification   | allowed  |
      | S3 Institutional due diligence | institutional finding | allowed  |
      | S2 Programme / TA            | member PII request      | rejected |

  @REQ-EVD-007 @BDD-EVD-016 @hard @wip
  Scenario: Standing is a pure function of events
    Given the same sequence of events replayed in a fresh database
    Then the computed standing is identical
    And standing never rises without an event naming the exact version

  @REQ-EVD-006 @BDD-EVD-017 @hard @wip
  Scenario Outline: The legacy evidence level is derived, never stored
    Given a claim with standing "<standing>"
    When the legacy level projection is computed
    Then the level is "<level>"
    And the projection is not stored as a source of truth

    Examples:
      | standing                              | level     |
      | entered, nothing further              | asserted  |
      | support item attached                 | supported |
      | admitted by an officer only           | asserted  |
      | finding on the current version        | verified  |
      | finding on an earlier version only    | asserted  |
