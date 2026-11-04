@phase5 @area-MTG
Feature: Meetings, minutes and resolutions
  Meetings are always recordable. Quorum is calculated from the rule and population snapshots,
  shown, and never blocks recording. Resolutions have effects that are atomic and idempotent.

  Background:
    Given an active cooperative with 30 members on the register
    And confirmed by-law rules: general meeting quorum is two thirds of members, notice is 7 days
    And Secretary "Chola", Chairperson "Zulu" and Treasurer "Banda" are appointed

  @REQ-MTG-001 @BDD-MTG-001 @hard @wip
  Scenario: A meeting stores the population and rule snapshots it used
    When a general meeting is scheduled
    Then the eligible-population snapshot lists 30 members at that time
    And the rule snapshot records quorum fraction 2/3 with the by-law clause
    When 3 members are later added
    Then the meeting's stored snapshot is unchanged

  @REQ-MTG-002 @BDD-MTG-002 @hard @wip
  Scenario Outline: Quorum is calculated and shown, never enforced
    When <present> members attend the general meeting
    Then the quorum result is "<result>"
    And the meeting minutes can still be recorded

    Examples:
      | present | result              |
      | 20      | met (20 of 30)      |
      | 12      | not demonstrated    |

  @REQ-MTG-002 @BDD-MTG-003 @policy @advisory @wip
  Scenario: A resolution at a meeting without demonstrated quorum is flagged
    Given the quorum result is "not demonstrated"
    When a resolution is recorded
    Then it is recorded
    And finding "MTG-001 quorum not demonstrated" is raised

  @REQ-MTG-002 @BDD-MTG-004 @policy @blocking @wip
  Scenario: The same resolution is rejected in blocking mode
    Given enforcement mode is "blocking" for rule "resolution requires quorum"
    And the quorum result is "not demonstrated"
    When a resolution is recorded
    Then the command is rejected with reason "QUORUM_NOT_DEMONSTRATED"

  @REQ-MTG-002 @BDD-MTG-005 @wip
  Scenario: Attendance is tied to member identity
    When attendance is recorded for a person not on the member register
    Then the attendee is counted as "non-member attendee"
    And not toward quorum

  @REQ-MTG-003 @BDD-MTG-006 @hard @SC-007 @wip
  Scenario: Minutes versions are immutable and approval is a separate event
    Given minutes version 1 submitted by Chola
    When Zulu approves version 1
    Then an approval event names version 1, Zulu, the position and the authority basis
    And the minutes version row is unchanged
    When Chola edits the minutes
    Then a version 2 is created and version 1 stays approved

  @REQ-MTG-003 @BDD-MTG-007 @policy @advisory @wip
  Scenario: Minutes approved by someone without approval duty are labelled
    When Banda, the Treasurer, approves minutes
    Then the approval is recorded
    And the label shows "Approved by Treasurer; approval duty is Chairperson or Vice-Chairperson"
    And finding "MTG-002 minutes not approved by duty-holder" is raised

  @REQ-MTG-004 @BDD-MTG-008 @policy @advisory @SC-008 @wip
  Scenario: A resolution without approved minutes is recorded and labelled
    Given the minutes of the meeting are not approved
    When the resolution "Appoint Tembo as Treasurer" is recorded
    Then the resolution status is "recorded"
    And the label is "Recorded; minutes not approved"
    And finding "MTG-003 resolution unbacked" is raised

  @REQ-MTG-004 @BDD-MTG-009 @policy @blocking @SC-008 @wip
  Scenario: The same resolution is rejected in blocking mode
    Given enforcement mode is "blocking" for rule "resolution requires approved minutes"
    And the minutes of the meeting are not approved
    When the resolution "Appoint Tembo as Treasurer" is recorded
    Then the command is rejected with reason "MINUTES_NOT_APPROVED"

  @REQ-MTG-005 @BDD-MTG-010 @hard @SC-018 @wip
  Scenario: Resolution effects apply atomically
    Given an approved resolution electing "Tembo" Treasurer and ending "Banda"'s term
    When effects are applied and the second effect fails
    Then neither appointment change is persisted
    And no event or outbox row exists for the resolution effect

  @REQ-MTG-005 @BDD-MTG-011 @hard @SC-016 @wip
  Scenario: Reprocessing a resolution does not duplicate effects
    Given an approved resolution electing "Tembo" Treasurer
    When the effects are applied twice with the same effect id
    Then there is exactly one appointment for Tembo as Treasurer

  @REQ-MTG-005 @BDD-MTG-012 @hard @wip
  Scenario: Governance changes cite their decision source
    When an appointment is created by a resolution
    Then the appointment references the resolution, the meeting and the minutes version

  @REQ-MTG-006 @REQ-BYL-004 @BDD-MTG-013 @hard @wip
  Scenario: A by-law amendment resolution creates a pending by-law version
    When the general meeting adopts a by-law amendment by a two-thirds vote
    Then a by-law version is created with status "adopted_pending_submission"
    And the resolution status is "pending_external_action"
    And the finding "Amendment adopted but not submitted to the Registrar" stays open

  @REQ-MTG-004 @BDD-MTG-014 @wip
  Scenario: Resolution classes that need external action are configurable
    Given resolution class "by-law amendment" requires "Registrar"
    And resolution class "disposal of property" has no external requirement configured
    When a resolution of each class is recorded
    Then the first shows "pending_external_action (Registrar)"
    And the second shows no external step
    When the by-laws are later confirmed to require registration for property disposal
    Then the class configuration can be updated without code change

  @REQ-MTG-007 @REQ-MTG-003 @BDD-MTG-015 @hard @wip
  Scenario: Statutory voting rules apply whatever the by-laws say
    Given the statutory seeds S-009: one vote per member, no proxy voting, chairperson casting vote on equality
    When a motion ends in a tie
    Then the chair's casting vote is recorded as such
    When a proxy vote is attempted
    Then the vote is recorded as "not counted: proxy voting not permitted (Act s.29(2))"
    And a finding is raised
    And the meeting record is not rejected

  @REQ-MTG-001 @BDD-MTG-016 @wip
  Scenario: Action items from minutes are tracked
    When minutes include an action item for the Treasurer
    Then it appears in the Treasurer's next actions
    And it links to the minutes version

  @REQ-MTG-007 @BDD-MTG-017 @policy @advisory @wip
  Scenario: Statutory and by-law rules are both shown and the stricter one is flagged
    Given by-law notice period for the annual general meeting is 7 days and the statute seed for special resolutions is 21 clear days
    When a special resolution is put at a meeting called with 7 days' notice
    Then the rule snapshot lists both sources with their clauses
    And the finding names the statutory 21-day requirement

  @REQ-MTG-008 @BDD-MTG-018 @policy @advisory @wip
  Scenario Outline: The board quorum is never below one half of the directors (Act s.46(3))
    Given a board of <directors> directors and a by-law quorum of <by_law_quorum>
    When <present> directors attend a board meeting
    Then the quorum result is "<outcome>"

    Examples:
      | directors | by_law_quorum | present | outcome                                                              |
      | 11        | 6             | 6       | met                                                                  |
      | 11        | 3             | 4       | not demonstrated: statutory minimum is one half of directors (s.46(3)) |
      | 7         | 4             | 3       | not demonstrated                                                     |

  @REQ-MTG-008 @BDD-MTG-019 @policy @advisory @wip
  Scenario: Board meeting notice and requisition follow the Act (s.46(2))
    When a board meeting is called by the Chairperson with 7 days' notice
    Then no finding is raised
    When a board meeting is called with 3 days' notice and no urgency is recorded
    Then finding "board meeting notice under seven days (Act s.46(2))" is raised
    When one third of directors request a board meeting in writing
    Then the meeting is shown as "must be called" with the request evidence

  @REQ-MTG-008 @BDD-MTG-020 @policy @advisory @wip
  Scenario: Minutes of every board meeting are required (s.46(4))
    Given a board meeting was held and no minutes are recorded
    Then finding "minutes of board meeting not recorded (Act s.46(4))" is raised

  @REQ-MTG-008 @REQ-PRV-003 @BDD-MTG-021 @policy @advisory @wip
  Scenario: A director's interest is disclosed, recorded and excludes voting (s.46(5)-(6))
    Given director "Phiri" has an interest in an agenda item
    When Phiri's disclosure is recorded in the minutes
    Then the minutes show the disclosure
    When Phiri's vote on that item is recorded
    Then the vote is shown as "not counted: disclosed interest (Act s.46(5))" unless the board directed otherwise
    And when the item's minutes carry no disclosure but a conflict is known, finding "interest not recorded in minutes" is raised

  @REQ-MTG-009 @BDD-MTG-022 @policy @advisory @wip
  Scenario: Removing a director needs two thirds of members or delegates present (s.47)
    Given the by-laws do not provide for removal
    When a general meeting removes a director with 60 percent of those present in favour
    Then the removal is recorded as "not carried" with finding "two-thirds of members present not reached (Act s.47(1))"
    When 70 percent are in favour
    Then the removal is recorded and the appointment ends with reason "removed by general meeting (s.47)"

  @REQ-MTG-009 @BDD-MTG-023 @wip
  Scenario: Removal of all directors can authorise the Registrar to appoint management for up to one year (s.47(2)-(3))
    When all directors are removed and the meeting authorises the Registrar to appoint officers by two-thirds of those present
    Then a Registrar-appointed management period of at most one year is recorded
    And the period ends when a new board is appointed

  @REQ-MTG-003 @BDD-MTG-024 @policy @advisory @wip
  Scenario: By-law amendment documents are signed by the chair of the meeting and the Secretary (s.20(2))
    When by-law amendment copies are prepared for submission to the Registrar
    Then the submission record requires the chair of the general meeting and the Secretary as signatories
    And a missing signatory raises finding "amendment copies not signed by chair of meeting and secretary (Act s.20(2))"
