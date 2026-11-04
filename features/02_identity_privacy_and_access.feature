@phase1 @area-PRV
Feature: Identity, privacy and access
  Personal data is encrypted, masked by role and tied to consent. Union/TA and institutions
  see capability gaps and aggregates, never member PII. The platform runs on test data only
  but behaves as if the Data Protection Act and residency rules were enforced.

  Background:
    Given an active cooperative "Nsenga Honey Growers" with synthetic members

  @REQ-PRV-001 @BDD-PRV-001 @hard @wip
  Scenario: Consent is required before personal data is entered
    When a Secretary tries to add member "M. Phiri" without recorded consent for purpose "cooperative_record_keeping"
    Then the command is rejected with reason "CONSENT_REQUIRED"
    When consent is recorded as "enroller_witnessed" for that purpose
    And the Secretary adds the member
    Then the member is recorded

  @REQ-PRV-001 @BDD-PRV-002 @hard @wip
  Scenario: Withdrawal of consent flags the record and starts the retention clock
    Given member "M. Phiri" with consent for "cooperative_record_keeping"
    When the member withdraws consent
    Then the record is flagged "consent_withdrawn"
    And the retention policy for "personal_membership_data" starts
    And the member's identifiers are no longer shown to officers without a lawful purpose

  @REQ-PRV-002 @REQ-ID-005 @BDD-PRV-003 @hard @wip
  Scenario: Identifiers are encrypted and duplicates are found by blind index
    Given a member with NRC "TS0001/01/1" matching the synthetic pattern
    Then the stored identifier is encrypted
    And a blind index exists for the identifier
    When another person is added with the same NRC
    Then a duplicate review is opened
    And the two records are not merged automatically

  @REQ-ID-005 @BDD-PRV-004 @wip
  Scenario: Members without an NRC use fallback identifiers
    When a Secretary adds an adult member without an NRC with identifier type "community_attested"
    Then the member is recorded with identifier type "community_attested"
    And duplicate review uses the blind indexes that exist for that person

  @REQ-PRV-003 @BDD-PRV-005 @hard @wip
  Scenario Outline: Role-based masking of member identifiers
    When a "<role>" requests the member list
    Then NRC values are "<nrc_view>"

    Examples:
      | role                    | nrc_view              |
      | secretary               | masked, reveal on need |
      | internal_verifier       | masked, reveal on need |
      | union_ta                | absent                 |
      | pfi_analyst             | absent                 |
      | member_of_other_coop    | absent                 |

  @REQ-PRV-004 @BDD-PRV-006 @hard @wip
  Scenario: Events and logs carry no personal data
    When members are added, edited and verified
    Then no domain event payload contains an NRC-shaped value
    And no application log line contains an NRC-shaped value
    And events reference persons by pseudonymous id only

  @REQ-PRV-005 @REQ-PRV-008 @BDD-PRV-007 @hard @wip
  Scenario: Retention crypto-shreds personal data but keeps pseudonymised transaction facts
    Given a former member whose retention period has ended
    And a recorded contribution transaction for that member
    When the retention job runs
    Then the member's personal fields cannot be decrypted
    And the contribution transaction remains under the pseudonymous id
    And the policy shows "retention_conflict_review_required"

  @REQ-PRV-006 @BDD-PRV-008 @wip
  Scenario: A member may inspect the register read-only
    When an ordinary member opens the register in inspection mode
    Then they see register entries permitted for inspection
    And they cannot edit any entry
    And the inspection is logged without personal data of other members

  @REQ-PRV-007 @REQ-PRV-009 @BDD-PRV-009 @hard @wip
  Scenario Outline: Test mode accepts only the synthetic identifier pattern
    Given data mode "test"
    When a Secretary adds a member with NRC "<nrc>"
    Then the result is "<result>"

    Examples:
      | nrc          | result                                                      |
      | TS0001/01/1  | recorded                                                    |
      | TSAB12/05/2  | recorded                                                    |
      | 123456/78/1  | rejected NON_SYNTHETIC_IDENTIFIER_IN_TEST_MODE              |
      | TS0001/01/4  | rejected NON_SYNTHETIC_IDENTIFIER_IN_TEST_MODE              |

  @REQ-PRV-009 @BDD-PRV-012 @hard @wip
  Scenario: Real mode treats the NRC pattern as advisory
    Given data mode "real" in an approved region
    When a Secretary adds a member whose NRC does not match the numeric pattern
    Then the member is recorded
    And a warning "NRC format not recognised" is shown
    And the record is not rejected

  @REQ-PRV-009 @REQ-ID-005 @BDD-PRV-013 @hard @wip
  Scenario: A re-issued card keeps a link to the previous number
    Given a member with NRC "TS0001/01/1"
    When the member's re-issued card is recorded with previous number "TS0001/01/1" and new number "TS0009/01/1"
    Then both numbers are linked to the same person
    And a duplicate review is not opened for the linked pair

  @REQ-PRV-009 @BDD-PRV-014 @hard @wip
  Scenario: The citizenship digit is masked and never used in decisions
    When an officer views a member's NRC
    Then the last digit is masked in the default display
    And no rule, finding or ranking uses that digit

  @REQ-PRV-007 @BDD-PRV-010 @hard @wip
  Scenario: Real mode refuses to start outside an approved residency region
    Given data mode "real" and residency region "not-approved"
    When the application starts
    Then startup fails with reason "RESIDENCY_REGION_NOT_APPROVED"

  @REQ-PRV-007 @BDD-PRV-011 @hard @wip
  Scenario: Purge-to-seed removes tenant data and restores the seed set
    Given a test database with enrolled cooperatives, evidence and events
    When the purge-to-seed job runs
    Then no tenant data remains
    And the seed catalogues, roles and demo tenant exist
    And a purge audit record is written

  @REQ-UNI-001 @REQ-UNI-002 @BDD-UNI-001 @hard @wip
  Scenario: Union TA sees assigned cohorts and capability gaps but no member PII
    Given the programme manager delegates TA scope for cohort "Eastern Honey" to union "Chipata Union"
    When a union TA user opens the capability gaps for a cooperative in that cohort
    Then they see the full capability gaps
    And no member names, NRCs or sensitive data appear
    When they open a cooperative outside the cohort
    Then they see "Outside your cohort"

  @REQ-UNI-001 @BDD-UNI-002 @hard @wip
  Scenario: Delegation is a chain and can be revoked
    Given a delegation from programme manager to union and from union to a TA officer
    When the programme manager revokes the union's delegation
    Then the TA officer loses access to the cohort
    And past TA actions remain in the audit trail

  @REQ-ID-002 @BDD-ID-001 @hard @SC-003 @wip
  Scenario: The registration certificate officers are history, not the current board
    Given the certificate lists "A. Banda" as Chairperson from 2019
    And the current Chairperson appointment is "C. Zulu" from 2025
    When the officeholders are listed
    Then "C. Zulu" is the current Chairperson
    And "A. Banda" appears only as certificate history

  @REQ-ID-003 @BDD-ID-002 @hard @wip
  Scenario: No seeded fallback values leak into real records
    Given a new organisation outside the demo tenant
    When the officeholder list is requested
    Then it contains only recorded appointments
    And it contains no seeded names

  @REQ-ID-004 @BDD-ID-003 @wip
  Scenario: The annual return is tracked separately from the certificate
    Given the certificate was issued in 2019
    When the annual return for 2025 is recorded as not filed
    Then a finding shows "Annual return not filed"
    And the certificate standing is unchanged

  @REQ-PRV-010 @BDD-PRV-015 @hard @wip
  Scenario: Statutory register fields rest on legal obligation, not consent
    When a member is added to the register with name, address, occupation, shares and date registered
    Then those fields have lawful basis "legal_obligation" citing the Act s.28
    And fields outside s.28, such as the identifier, still require a recorded basis such as consent
    And withdrawing consent does not remove the statutory register fields while the legal obligation applies

  @REQ-PRV-010 @REQ-PRV-006 @BDD-PRV-016 @hard @wip
  Scenario: Public inspection on payment of the prescribed fee shows only statutory fields (Act s.21, s.28)
    Given the society's inspection fee is configured as "K 20"
    When a member of the public asks to inspect the list of members and records receipt "R-0001" for the fee
    Then an inspection session opens for that person
    And only name, address, occupation and date registered are shown
    And no identifier, contact detail, shareholding amount or sensitive data appears
    And the session records the inspector's name, fee receipt reference, time and fields shown
    And Symphony does not process the payment itself

  @REQ-PRV-006 @BDD-PRV-018 @hard @wip
  Scenario: A member inspects free of charge and sees the same statutory fields
    When an ordinary member asks to inspect the by-laws and list of members
    Then no fee is required
    And the inspection is logged without personal data of the members viewed

  @REQ-PRV-006 @BDD-PRV-019 @wip
  Scenario: Inspection of by-laws and regulations needs no personal data
    When a member of the public inspects the by-laws on payment of the fee
    Then the by-laws version of record is shown with its registration status
    And no member data is shown

  @REQ-PRV-011 @BDD-PRV-020 @hard @wip
  Scenario: An individual member's accounts need that member's written consent (Act s.59(2))
    When a person who is not an officer asks to see another member's account records
    Then the request is rejected with reason "MEMBER_CONSENT_OR_GENERAL_MEETING_RESOLUTION_REQUIRED"
    When the member's written consent is recorded as evidence
    Then the account records are shown for that member only
    And officers and members or delegates may inspect the society's own books of account during office hours

  @REQ-ID-008 @BDD-PRV-017 @hard @wip
  Scenario: Minors are not accepted as members until the legal reviewer advises (policy default)
    Given policy "allow_minor_members" is off
    When a Secretary adds a member who is under 18
    Then the command is rejected with reason "MINOR_MEMBERSHIP_NOT_ENABLED"
    And the screen shows "Minor members: platform capability not enabled; legal reviewer to advise"
    And the rejection does not claim the Act forbids minors, because s.24 permits them

  @REQ-ID-008 @BDD-PRV-021 @wip
  Scenario: Enabling minor membership needs a recorded legal review
    When the programme manager records the legal reviewer's advice and sets policy "allow_minor_members" on
    Then minor members can be added with the lawful basis and guardian consent rules from that advice
    And the policy change is audited
