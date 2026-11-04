@phase2 @area-VER
Feature: Internal Field Verifier and field agents
  The Internal Field Verifier (IFV) is a capacity bound to one organisation. It can be added to any
  user or held by a dedicated user. Its findings are cooperative-internal and are never presented
  as independent verification.

  Background:
    Given an active cooperative "Nsenga Honey Growers" with Chairperson "Zulu", Secretary "Chola", Treasurer "Banda" and member "Mwila"

  @REQ-VER-001 @BDD-VER-001 @hard @wip
  Scenario: The IFV capacity can be added to an existing role
    When Zulu grants the "internal_verifier" capacity to Chola
    Then Chola is Secretary and an internal verifier
    And the grant is recorded with grantor, time and organisation

  @REQ-VER-001 @BDD-VER-002 @hard @wip
  Scenario: The IFV can be a dedicated user with no other role
    When Zulu creates user "Ndhlovu" with only the "internal_verifier" capacity
    Then Ndhlovu can open the verification queue
    And Ndhlovu cannot approve minutes or admit evidence as an officer

  @REQ-VER-001 @BDD-VER-003 @hard @wip
  Scenario Outline: Who may grant the IFV capacity
    When "<actor>" tries to grant the "internal_verifier" capacity to Mwila
    Then the result is "<result>"

    Examples:
      | actor                         | result   |
      | Chairperson                   | allowed  |
      | Vice-Chairperson              | allowed  |
      | enroller during session       | allowed  |
      | Secretary                     | rejected |
      | member                        | rejected |

  @REQ-VER-001 @BDD-VER-004 @hard @wip
  Scenario: A capacity for one organisation confers nothing elsewhere
    Given Ndhlovu is internal verifier for "Nsenga Honey Growers"
    When Ndhlovu tries to record a finding in "Chipata Fish Farmers"
    Then the command is rejected with reason "NOT_AUTHORISED_FOR_ORGANISATION"

  @REQ-VER-002 @BDD-VER-005 @hard @wip
  Scenario: A finding names the exact version, scope and assurance class
    Given Mwila supplied claim "10 goats" version 1
    When Ndhlovu records a finding "conformant" with method "head-count", scope "12 October visit" and limitation "goats at pasture not counted"
    Then the finding records version 1, class "cooperative_internal", scope, method and limitation
    And the label reads "Verified by internal verifier (scope: 12 October visit)"

  @REQ-VER-003 @BDD-VER-006 @hard @SC-010 @wip
  Scenario: An IFV cannot verify what they supplied
    Given Ndhlovu supplied claim "5 beehives"
    When Ndhlovu records a finding on it
    Then the command is rejected with reason "SELF_VERIFICATION"

  @REQ-VER-003 @BDD-VER-007 @hard @wip
  Scenario: Holding two capacities does not bypass the conflict rule
    Given Chola is Secretary and internal verifier
    And Chola uploaded the member register
    When Chola records a finding on the member register
    Then the command is rejected with reason "SELF_VERIFICATION"
    And the check used the person, not the role

  @REQ-VER-003 @BDD-VER-008 @hard @wip
  Scenario: An IFV cannot verify what they collected for another person
    Given Ndhlovu transcribed claim "8 hives" on Mwila's behalf as field agent
    When Ndhlovu records a finding on it
    Then the command is rejected with reason "COLLECTOR_CANNOT_VERIFY"

  @REQ-VER-003 @BDD-VER-009 @policy @advisory @wip
  Scenario: An IFV who admitted a record may verify it only with a disclosure in advisory mode
    Given Ndhlovu admitted claim "20 fingerlings" supplied by Mwila
    When Ndhlovu records a finding on it
    Then the finding is recorded
    And the standing shows flag "verifier also admitted this record"

  @REQ-VER-003 @BDD-VER-010 @policy @blocking @wip
  Scenario: The same case is rejected in blocking mode
    Given enforcement mode is "blocking" for rule "verifier may not have admitted"
    And Ndhlovu admitted claim "20 fingerlings" supplied by Mwila
    When Ndhlovu records a finding on it
    Then the command is rejected with reason "ADMITTER_CANNOT_VERIFY"

  @REQ-VER-004 @BDD-VER-011 @hard @SC-011 @wip
  Scenario: A finding on version 1 gives no standing to version 2
    Given a finding "conformant" on claim version 1
    When the claim is amended to version 2
    Then version 2 has no finding
    And a verification assignment is needed for version 2

  @REQ-VER-005 @BDD-VER-012 @hard @wip
  Scenario: External views say internal verification is not independent
    When a lender views a claim verified by the IFV
    Then the label includes "Cooperative-verified, not independent"
    And the label includes "your own due diligence applies"

  @REQ-EVD-004 @BDD-VER-013 @hard @wip
  Scenario: Officers may dispute a finding but cannot edit or delete it
    Given a finding by Ndhlovu on Mwila's claim
    When Zulu tries to edit the finding
    Then the command is rejected with reason "FINDING_IMMUTABLE"
    When Zulu raises a dispute against the finding with a reason
    Then the dispute is recorded and the finding is unchanged

  @REQ-VER-006 @BDD-VER-014 @hard @wip
  Scenario: Revoking the capacity keeps past findings
    Given Ndhlovu recorded three findings
    When Zulu revokes Ndhlovu's internal_verifier capacity
    Then the three findings remain with class "cooperative_internal"
    And each is annotated "verifier no longer active"
    And Ndhlovu cannot record new findings

  @REQ-VER-001 @BDD-VER-015 @hard @INV-013 @wip
  Scenario: Two IFVs disagreeing blocks promotion until a third resolves it
    Given IFV "Ndhlovu" records "conformant" and IFV "Kunda" records "not_conformant" on the same version
    Then the claim shows "Verification in conflict"
    When Zulu, an officer, tries to resolve the conflict
    Then the command is rejected with reason "OFFICER_CANNOT_RESOLVE_VERIFICATION_CONFLICT"
    When a third IFV records a finding
    Then the conflict is resolved by that finding with the original findings retained

  @REQ-VER-007 @BDD-VER-016 @hard @wip
  Scenario: A field agent's authority ends at their employer
    Given field agent "Lungu" is employed by "Nsenga Honey Growers"
    When a lender looks at an observation attested by Lungu
    Then the label reads "Observed by field agent (employer: Nsenga Honey Growers)"
    And it is not shown as independent verification

  @REQ-VER-007 @BDD-VER-017 @hard @wip
  Scenario: A cooperative field agent cannot attest in another cooperative
    When Lungu attests an observation in "Chipata Fish Farmers"
    Then the command is rejected with reason "NOT_AUTHORISED_FOR_ORGANISATION"

  @REQ-VER-008 @BDD-VER-018 @wip
  Scenario: A platform check and an IFV finding are shown separately
    Given a claim with an IFV finding and a platform check by an enroller
    When a programme manager views the claim
    Then both classes are listed with their own scope and actor
    And neither replaces the other
