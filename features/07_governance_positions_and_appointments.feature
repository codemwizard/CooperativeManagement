@phase4 @area-GOV
Feature: Governance positions, appointments and committees
  Symphony records governance as it is and highlights what does not comply with the by-laws.
  It does not enforce unless an organisation turns enforcement on.

  Background:
    Given an active cooperative with a governance profile having Chairperson, Vice-Chairperson, Secretary, Treasurer, Director and an Audit Committee

  @REQ-GOV-001 @BDD-GOV-001 @hard @INV-002 @wip
  Scenario: A position is not a person and a platform role is not an office
    Given user "Chola" has platform role "member"
    When Chola is appointed Secretary
    Then the appointment exists independently of the platform role
    And removing the appointment does not remove the user

  @REQ-GOV-002 @BDD-GOV-002 @hard @SC-020 @wip
  Scenario Outline: Vacant, combined and unknown positions are recordable
    When the "<position>" position is recorded as "<state>"
    Then the state is stored with source and note
    And no compliance claim is made

    Examples:
      | position         | state                      |
      | Treasurer        | vacant                     |
      | Vice-Chairperson | not provided by by-laws    |
      | Secretary        | combined with Treasurer    |
      | Director         | unknown                    |

  @REQ-GOV-003 @BDD-GOV-003 @hard @SC-004 @wip
  Scenario: Replacing an officeholder keeps history
    Given "Zulu" is Chairperson from 2025-01-01
    When "Tembo" is appointed Chairperson from 2026-03-01 by resolution
    Then Zulu's appointment ends on 2026-02-28
    And both appointments remain in the history
    And the current Chairperson is Tembo

  @REQ-GOV-003 @BDD-GOV-004 @policy @advisory @SC-002 @wip
  Scenario: An appointment without an authority source is recorded with a finding
    When "Mwila" is appointed Treasurer with no resolution or minutes reference
    Then the appointment is recorded
    And finding "GOV-012 appointment lacks source" is raised

  @REQ-GOV-003 @BDD-GOV-005 @policy @blocking @SC-002 @wip
  Scenario: The same appointment is rejected in blocking mode
    Given enforcement mode is "blocking" for rule "appointment requires source"
    When "Mwila" is appointed Treasurer with no resolution or minutes reference
    Then the command is rejected with reason "APPOINTMENT_SOURCE_REQUIRED"

  @REQ-GOV-004 @BDD-GOV-006 @policy @advisory @SC-005 @wip
  Scenario: The same person as Chairperson and Vice-Chairperson is flagged
    Given "Zulu" is Chairperson
    When "Zulu" is also appointed Vice-Chairperson
    Then both appointments are recorded
    And finding "GOV-011 combination rule violated" names both positions

  @REQ-GOV-004 @BDD-GOV-007 @policy @blocking @SC-005 @wip
  Scenario: The same appointment is rejected in blocking mode with the database constraint enforced
    Given enforcement mode is "blocking" for rule "chair and vice-chair distinct"
    And "Zulu" is Chairperson
    When "Zulu" is also appointed Vice-Chairperson
    Then the command is rejected with reason "EXCLUSIVE_POSITION_OVERLAP"

  @REQ-GOV-004 @BDD-GOV-008 @wip
  Scenario Outline: All other combinations are allowed by default
    Given "Chola" is "<first>"
    When "Chola" is also appointed "<second>"
    Then no combination finding is raised

    Examples:
      | first     | second     |
      | Secretary | Treasurer  |
      | Director  | Secretary  |
      | Treasurer | Director   |

  @REQ-GOV-004 @BDD-GOV-009 @policy @advisory @wip
  Scenario: An audit committee member on the Board is flagged
    Given "Phiri" is a member of the Audit Committee
    When "Phiri" is appointed a Director
    Then finding "GOV-011 combination rule violated" names "Audit Committee" and "Board"

  @REQ-GOV-005 @BDD-GOV-010 @hard @wip
  Scenario: An acting appointment does not overwrite the substantive one
    Given "Zulu" is Chairperson
    When "Tembo" is recorded as acting Chairperson from 1 to 14 June
    Then the acting appointment is separate
    And Zulu's appointment is unchanged
    And authority checks during those dates accept Tembo as acting

  @REQ-GOV-006 @BDD-GOV-011 @wip
  Scenario: Committee membership is temporal
    When "Phiri" joins the Audit Committee on 2025-02-01 and leaves on 2025-11-30
    Then Phiri is a member only within those dates
    And the history shows the term

  @REQ-GOV-007 @BDD-GOV-012 @hard @SC-003 @wip
  Scenario: Certificate officers are never shown as the current board
    Given the registration certificate lists former officers
    When the Board is displayed
    Then only appointments are shown
    And the certificate list appears as "Officers at registration"

  @REQ-GOV-003 @BDD-GOV-013 @hard @wip
  Scenario: Historical appointments are recorded through the same append-only process
    When an appointment from 2019 is recorded in 2026
    Then it carries "recorded_late"
    And it cannot be edited in place
    And a correction creates a new record

  @REQ-GOV-003 @BDD-GOV-014 @policy @advisory @wip
  Scenario: An expired term is flagged but not removed
    Given a Director whose term ended last year and no re-election is recorded
    Then finding "GOV-013 appointment term expired" is raised
    And the Director still appears in the history

  @REQ-GOV-002 @BDD-GOV-015 @wip
  Scenario: A new position type needs no code change
    When the governance profile adds position "Credit Committee Chair"
    Then the position can be appointed
    And the Duty Matrix can reference it

  @REQ-GOV-009 @BDD-GOV-016 @policy @advisory @wip
  Scenario Outline: Committee composition follows the statutory seed
    Given committee "<committee>" with <members> members of whom <employees> are employees of the society
    Then the result is "<result>"

    Examples:
      | committee       | members | employees | result                                                          |
      | Audit Committee | 3       | 0         | no finding                                                      |
      | Audit Committee | 2       | 0         | finding "committee has fewer than three members (Act s.39(2))"  |
      | Education       | 4       | 1         | finding "committee includes an employee of the society (Act s.39(2))" |

  @REQ-GOV-009 @BDD-GOV-017 @policy @advisory @wip
  Scenario: A director who is not a member is flagged
    When a person who is not on the member register is appointed a Director
    Then the appointment is recorded
    And finding "director is not a member (Act s.38(1))" is raised

  @REQ-GOV-004 @BDD-GOV-018 @wip
  Scenario: Founder default rules are labelled as such, not as statute
    When the Audit Committee and Board combination finding is shown
    Then its source reads "founder default"
    And it does not cite a section of the Act

  @REQ-GOV-010 @BDD-GOV-019 @policy @advisory @wip
  Scenario Outline: A director may not hold office more than six consecutive years (Act s.43(2))
    Given a director first elected on "<first_elected>" and re-elected continuously
    When the appointment history is evaluated on "2026-11-04"
    Then the result is "<outcome>"

    Examples:
      | first_elected | outcome                                                                  |
      | 2022-03-01    | no finding                                                               |
      | 2019-03-01    | finding "director exceeds six consecutive years (Act s.43(2))"           |

  @REQ-GOV-010 @BDD-GOV-020 @policy @advisory @wip
  Scenario: A director is eligible again after a lapse of one year
    Given a director whose six consecutive years ended on 2023-12-31
    When the director is re-elected on 2025-03-01
    Then no finding is raised
    When the same director is re-elected on 2024-06-01 after a lapse of under one year
    Then finding "re-election within one year of the six-year limit (Act s.43(2))" is raised

  @REQ-GOV-011 @BDD-GOV-021 @policy @advisory @wip
  Scenario Outline: Chairperson and Vice-Chairperson eligibility (Act s.42(1))
    When "<person>" is appointed Chairperson
    Then the result is "<outcome>"

    Examples:
      | person                                        | outcome                                                                   |
      | a member of this society                      | no finding                                                                |
      | a direct employee of this society             | finding "chairperson is a direct employee (Act s.42(1))"                  |
      | a person who is not a member                  | finding "chairperson is not a member (Act s.42(1))"                       |
      | a chair of another society on the platform    | finding "holds chair or vice-chair in another co-operative (Act s.42(1))" |

  @REQ-GOV-011 @REQ-PRV-003 @BDD-GOV-022 @hard @wip
  Scenario: The cross-society check never reveals the other society to officers
    Given the same person is Chairperson of two societies on the platform
    When an officer of either society views the finding
    Then the finding says only that the person holds chair or vice-chair elsewhere
    And it does not name the other society or any personal data

  @REQ-GOV-010 @BDD-GOV-023 @policy @advisory @wip
  Scenario Outline: A director's office becomes vacant on the statutory grounds (Act s.44(3))
    When the director's appointment ends with reason "<reason>"
    Then the end reason is recorded as "<reason>"
    And the vacancy is flagged for filling

    Examples:
      | reason                                                                |
      | removed by general meeting (s.47)                                     |
      | resigned with one month's written notice                              |
      | holds a remunerative office in the society                            |
      | declared bankrupt                                                     |
      | declared of unsound mind                                              |
      | undisclosed interest in a contract with the society                   |
      | sentenced to imprisonment exceeding six months                        |
      | lawfully detained for more than three months                          |
      | gross misconduct under the by-laws                                    |
      | died or ceased to be a member                                         |

  @REQ-GOV-010 @BDD-GOV-024 @policy @advisory @wip
  Scenario: A director who holds a remunerative office is flagged
    Given a director who is also a paid Treasurer
    Then finding "director holds a remunerative office in the society; office may be vacant (Act s.44(3)(c))" is raised
    And the appointments are not changed automatically

  @REQ-GOV-010 @BDD-GOV-025 @policy @advisory @wip
  Scenario: Filling a vacancy follows the Act unless the by-laws say otherwise (s.44(1)-(2))
    Given a casual vacancy on the board and no by-law provision on filling vacancies
    When the remaining directors appoint a replacement
    Then the appointment is recorded with source "board, until next general meeting"
    Given the remaining directors are fewer than the by-law quorum
    Then finding "special meeting to fill vacancy must be called forthwith (Act s.44(2))" is raised

  @REQ-GOV-012 @BDD-GOV-026 @wip
  Scenario Outline: Appointment sources differ by office
    When "<office>" is appointed with source "<source>"
    Then the result is "<outcome>"

    Examples:
      | office                  | source                          | outcome                                          |
      | Chairperson             | general meeting election        | no finding                                       |
      | Director                | annual general meeting election | no finding                                       |
      | Secretary               | board appointment (s.42(2))     | no finding                                       |
      | Treasurer               | board appointment (s.42(2))     | no finding                                       |
      | Audit Committee member  | annual general meeting election | no finding                                       |
      | Director                | board appointment               | finding "directors are elected by members (Act s.38(1))" |
