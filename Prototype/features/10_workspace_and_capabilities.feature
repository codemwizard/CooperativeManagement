@phase1 @area-UXW
Feature: Workspace, status vocabulary and extension capabilities
  The workspace shows exactly what the model supports. It never shows a score on readiness surfaces,
  never leaks enum text, never claims more than the evidence shows, and always makes capability gaps visible.

  Background:
    Given the workspace is running with seed data in test mode

  @REQ-UXW-001 @BDD-UXW-001 @ui
  Scenario Outline: Navigation is scoped to the persona and every screen has a URL
    When "<persona>" signs in
    Then the primary navigation shows "<items>"
    And each item opens a route with one h1 and a document title

    Examples:
      | persona            | items                                                                                              |
      | secretary          | Overview, Identity, By-laws and requirements, Governance, Meetings and resolutions, Evidence register, Findings and next actions |
      | internal verifier  | Overview, Evidence register, Verification queue, Findings and next actions                          |
      | programme manager  | Pipeline, Cohort, Directory, Legal catalogue review, Delegations                                    |
      | union ta           | Cohort, Capability gaps                                                                              |
      | self-enroller      | Certificate details, Create officer accounts, Hand over                                              |

  @REQ-UXW-001 @BDD-UXW-002 @ui
  Scenario: Route changes move focus and survive reload
    When the user opens "/coop/org-1/evidence" and presses Back and Forward
    Then focus moves to the page h1 each time
    And filters and sort order persist in the URL query

  @REQ-UXW-002 @BDD-UXW-003 @ui @hard
  Scenario: No enum text reaches the user
    When every route is rendered with seed data
    Then no rendered text contains snake_case enum values
    And no rendered text contains the phrases "compliant", "approved" without authority or a bare "Verified"

  @REQ-UXW-002 @BDD-UXW-004 @ui @hard
  Scenario: Verified chips carry scope, verifier, version and class
    When an item verified by the internal verifier is expanded
    Then the chip text includes the verifier, scope, version and "cooperative-internal"

  @REQ-UXW-005 @BDD-UXW-005 @ui @wip
  Scenario Outline: The status strip uses shape, colour and text together
    When an item with standing "<standing>" is rendered
    Then the chip shows text "<text>" and a "<shape>" icon
    And the meaning does not depend on colour alone

    Examples:
      | standing                 | text                           | shape            |
      | asserted                 | Self-declared                  | half-filled      |
      | supported                | Supported (proof attached)     | half-filled      |
      | awaiting_duty_submission | Working copy, outside Secretary process | dashed outline |
      | draft_submitted          | Draft, awaiting approval       | open square      |
      | approved_official        | Official cooperative record    | filled square    |
      | verified_internal        | Cooperative-verified (internal) | ringed circle   |
      | held_draft               | Held as draft: by-law not amended | hourglass     |
      | disputed                 | Disputed                       | triangle         |

  @REQ-UXW-002 @BDD-UXW-006 @ui @hard @wip
  Scenario: Readiness surfaces show counts and gaps, never a score
    When the Overview and Findings screens are rendered
    Then they show counts with links to the records behind them
    And no percentage readiness, donut or verdict pill appears

  @REQ-UXW-002 @REQ-EXT-004 @BDD-UXW-007 @ui @wip
  Scenario: The evidence-quality panel is separate and labelled
    When the evidence-quality panel is rendered
    Then it shows the caption "Evidence-quality measure, not an ESG performance rating"
    And it shows the anti-inference guardrails beside any value
    And it is not part of the readiness counts

  @REQ-UXW-003 @REQ-EXT-005 @BDD-UXW-008 @ui @wip
  Scenario: A module that is not implemented shows a capability gap
    Given the Operational module is "not_implemented"
    When a cooperative official opens Overview
    Then a capability gap chip "Operational metrics: platform capability not implemented" is visible
    And no invented flow is offered

  @REQ-UXW-003 @BDD-UXW-009 @ui @wip
  Scenario: Blocked actions explain themselves in text and are announced
    When an official attempts an action that needs Chairperson approval
    Then the action stays focusable with aria-disabled
    And the reason "Needs Chairperson or Vice-Chairperson approval" is visible text
    And a blocked result is announced with role alert and the rule code is shown in small monospace
    And focus is not stolen

  @REQ-UXW-004 @BDD-UXW-010 @ui @hard @wip
  Scenario: Demo tooling is separate from product screens
    When any persona screen is rendered
    Then it contains no reset, tour, event log or scripted step control
    When the DemoPanel is opened in test mode
    Then reset requires confirmation before running

  @REQ-UXW-004 @BDD-UXW-011 @ui @hard @wip
  Scenario: Seed values are never presented as real
    Given an organisation outside the demo tenant
    When any screen is rendered
    Then no seeded name or value appears

  @REQ-UXW-001 @BDD-UXW-012 @ui @wip
  Scenario: The self-enroller sees only three screens
    When a self-enroller signs in
    Then only "Certificate details", "Create officer accounts" and "Hand over" are reachable
    And every other route redirects with an explanation

  @REQ-UXW-005 @BDD-UXW-013 @ui @wip
  Scenario: The provenance drawer is accessible and complete
    When the provenance drawer is opened from a row
    Then it has role dialog with a label, traps focus, closes on Escape and returns focus to the row
    And it lists supplied, admitted or submitted, approved, verified with class, disputes, history, duty process and limitation

  @REQ-UXW-002 @BDD-UXW-014 @ui @wip
  Scenario: Next actions are ranked and show who must act
    Given three open findings of differing severity
    When the next-action panel is rendered
    Then at most four actions are shown with one primary
    And actions requiring someone else show the owner role and needed authority

  @REQ-UXW-005 @BDD-UXW-015 @ui
  Scenario: Audience-relative wording is shown to institutions
    When a lender opens a claim verified by the internal verifier
    Then the page shows "Cooperative-verified, not independent; your own due diligence applies"

  @REQ-EXT-001 @BDD-EXT-001 @hard @wip
  Scenario: Every specified module has a capability entry
    Given the module registry
    Then every module has a status of not_implemented, specified, in_progress or available
    And modules not available are listed with their spec reference

  @REQ-EXT-003 @BDD-EXT-002 @hard @wip
  Scenario: A new indicator is added by data only
    When an indicator definition row and a rule version are inserted for a test indicator
    Then the indicator can be observed and calculated
    And no schema migration was required

  @REQ-EXT-003 @BDD-EXT-003 @hard @wip
  Scenario: Indicator calculations are immutable and reproducible
    Given an indicator calculation with a definitions fingerprint and input fingerprint
    When the same inputs are calculated again
    Then the calculation id is identical
    And the earlier calculation is unchanged

  @REQ-EXT-004 @BDD-EXT-004 @hard @wip
  Scenario: EQS and ESG Index outputs are unchanged when read through adapters
    Given the legacy EQS and ESG Index fixtures
    When the adapters read the equivalent relational projections
    Then the outputs equal the legacy outputs exactly

  @REQ-EXT-002 @BDD-EXT-005 @wip
  Scenario: A module cannot be marked available without its artefacts
    When a module is set to "available" without spec, catalogue, rules, features and fixtures
    Then the registry rejects the status change with the list of missing artefacts

  @REQ-EXT-005 @BDD-EXT-006 @wip
  Scenario: Operational and ESG modules are declared and visible
    Then the registry lists "Operational" and "ESG/impact" modules as "not_implemented" or "specified"
    And their backlog items reference the stage checklist

  @REQ-UXW-002 @BDD-UXW-016 @ui @wip
  Scenario: Legal content always carries the disclaimer
    When any screen shows statutory or legal catalogue content
    Then the text "Symphony does not provide legal advice" is visible on that screen
