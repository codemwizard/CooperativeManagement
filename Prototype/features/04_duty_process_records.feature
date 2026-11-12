@phase5 @area-EVD
Feature: Records and the duty process
  Anyone may author and version a record. The state shows whether the duty-holder has taken
  it into the duty process and whether the approver has approved the exact version.

  Background:
    Given an active cooperative with Secretary "Chola", Chairperson "Zulu", Vice-Chairperson "Tembo", Treasurer "Banda" and member "Mwila"
    And the Duty Matrix v1 is loaded

  @REQ-EVD-008 @BDD-DUT-001 @hard @wip
  Scenario: Minutes uploaded by the Secretary go straight to draft
    When Chola uploads minutes for the annual general meeting
    Then the minutes version 1 has status "draft_submitted"
    And the label is "Draft, awaiting approval by Chairperson or Vice-Chairperson"

  @REQ-EVD-008 @BDD-DUT-002 @hard @wip
  Scenario: Minutes uploaded by someone else are a working copy outside the Secretary process
    When Mwila uploads minutes for the annual general meeting
    Then the minutes version 1 has status "awaiting_duty_submission"
    And the label is "Working copy, outside Secretary process"
    And the history is flagged "authored_outside_duty_process"

  @REQ-EVD-008 @BDD-DUT-003 @wip
  Scenario: Anyone may keep versioning a working copy
    Given Mwila uploaded minutes version 1
    When Mwila uploads version 2 with corrections
    Then both versions exist
    And version 2 has status "awaiting_duty_submission"
    And neither version is lost

  @REQ-EVD-008 @BDD-DUT-004 @hard @wip
  Scenario: The Secretary adopts a specific version into the duty process
    Given Mwila uploaded minutes versions 1 and 2
    When Chola submits version 2
    Then version 2 has status "draft_submitted"
    And the label shows "Prepared by Mwila; submitted by Secretary Chola"
    And version 1 remains "awaiting_duty_submission"
    And the outside-process flag stays visible in the history

  @REQ-EVD-003 @BDD-DUT-005 @hard @wip
  Scenario: The Chairperson approves the exact submitted version
    Given Chola submitted minutes version 2
    When Zulu approves version 2
    Then version 2 has status "approved_official"
    And the label is "Official cooperative record, approved by Zulu (Chairperson)"
    And a new version 3 would start again at "draft_submitted" or "awaiting_duty_submission"

  @REQ-EVD-003 @BDD-DUT-006 @hard @SC-007 @wip
  Scenario: Approval names the exact version and later versions need new approval
    Given version 2 is approved
    When Chola uploads version 3
    Then version 2 remains "approved_official"
    And version 3 is not approved

  @REQ-EVD-003 @BDD-DUT-007 @policy @advisory @wip
  Scenario: Approving a version nobody submitted is recorded with a finding in advisory mode
    Given Mwila uploaded minutes version 1 and nobody submitted it
    When Zulu approves version 1
    Then version 1 has label "Approved without duty submission"
    And finding "EVD-001" is raised

  @REQ-EVD-003 @BDD-DUT-008 @policy @blocking @wip
  Scenario: Approving a version nobody submitted is rejected in blocking mode
    Given enforcement mode is "blocking" for rule "approval requires duty submission"
    And Mwila uploaded minutes version 1 and nobody submitted it
    When Zulu approves version 1
    Then the command is rejected with reason "DUTY_SUBMISSION_REQUIRED"

  @REQ-EVD-003 @BDD-DUT-009 @policy @advisory @wip
  Scenario: The preparer approving their own record is labelled
    Given the Chairperson prepared and submitted a report as Chairperson's report
    When the same Chairperson approves it
    Then the label shows "Approved by preparer"
    And it counts as approved only when policy "distinct_actors" is off

  @REQ-EVD-003 @BDD-DUT-010 @policy @wip
  Scenario Outline: Dual sign-off is configuration
    Given the Duty Matrix row "<class>" requires <approvers> distinct approvers
    When one approver approves the exact version
    Then the status is "<status>"

    Examples:
      | class                | approvers | status                         |
      | Minutes              | 1         | approved_official              |
      | Financial statements | 2         | draft_submitted                |

  @REQ-EVD-008 @BDD-DUT-011 @wip
  Scenario: A vacant duty position is covered visibly
    Given the Secretary position is vacant
    When Tembo, the Vice-Chairperson, submits minutes version 1
    Then the status is "draft_submitted"
    And the label shows "Submitted by Vice-Chairperson in place of vacant Secretary"

  @REQ-EVD-008 @BDD-DUT-012 @hard @wip
  Scenario Outline: Each duty-holder's records follow their own process
    When "<submitter>" uploads "<class>"
    Then the status is "<status>"
    And the approver required is "<approver>"

    Examples:
      | submitter | class                | status                    | approver                        |
      | Banda     | Financial statements | draft_submitted           | Board then general meeting      |
      | Chola     | Financial statements | awaiting_duty_submission  | Board then general meeting      |
      | Mwila     | Financial statements | awaiting_duty_submission  | Board then general meeting      |
      | Chola     | Minutes              | draft_submitted           | Chairperson or Vice-Chairperson |
      | Banda     | Minutes              | awaiting_duty_submission  | Chairperson or Vice-Chairperson |

  @REQ-EVD-008 @BDD-DUT-013 @wip
  Scenario: Committee reports follow the committee's own duty
    Given an audit committee with member "Phiri"
    When Phiri uploads the audit committee report
    Then the status is "draft_submitted"
    And the approver required is "General meeting"
    When Banda, the Treasurer, uploads the same report
    Then the status is "awaiting_duty_submission"
    And finding "EVD-001" notes that the Treasurer does not hold the audit duty

  @REQ-EVD-005 @BDD-DUT-014 @hard @wip
  Scenario: Wherever a record is relied on its provenance is one click away
    When an institution views an approved minutes record
    Then the label reads "Official cooperative record approved by Zulu (Chairperson); authenticity not independently verified"
    And the provenance drawer lists author, submitter, approver, versions and limitations
