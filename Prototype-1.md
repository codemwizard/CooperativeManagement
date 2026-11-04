# Symphony GreenCode Zambia

## Prototype Plan & Workflow v1.0

### Prototype Theme

> **Infrastructure for making the Green Economy assessable, financeable and accountable.**

### Prototype Thesis

The prototype demonstrates that Symphony is not an SME onboarding application.

It is an underlying **governed state and evidence infrastructure** that can support a green-economy journey from:

```text
Economically Real Enterprise
        ↓
Project Established
        ↓
Current State Established
        ↓
Green / Financing Requirements
        ↓
Evidence Generated
        ↓
Assessment Readiness
        ↓
Financing Decision
        ↓
Portfolio Monitoring
        ↓
Independent Verification
        ↓
Assurance / Reporting
```

The prototype should make this architecture apparent through the application itself rather than through an explanation of the architecture.

---

# 1. PRODUCT STORY

The prototype should follow one representative enterprise/project through its lifecycle.

The primary demonstrator is a rural cooperative because it gives the audience a concrete starting point.

However, the underlying Project should be capable of representing a broader green-economy activity.

For example:

```text
Organization
  Chisamba Farmers Cooperative

Project
  2027 Climate-Smart Maize Production & Aggregation

Green dimensions
  Agriculture
  Water/resource use
  Climate resilience
  Land/environmental baseline

Financing destination
  PFI A — Sustainable Agriculture Facility
```

The same infrastructure should subsequently show how another type of project could be represented:

```text
Organization
  Green Energy SME

Project
  Solar productive-use installation

Green dimensions
  Energy
  Emissions/resource efficiency
  Community access
```

The purpose is not to build a second SME application.

The purpose is to demonstrate:

> **The project type changes. The governing infrastructure does not.**

---

# 2. PRIMARY USER JOURNEY

The complete prototype journey is:

```text
01  Discover / Login
        ↓
02  Organization
        ↓
03  Project
        ↓
04  Establish Current State
        ↓
05  Define Green / Financing Requirements
        ↓
06  Generate & Govern Evidence
        ↓
07  Remediate Gaps
        ↓
08  Assessment Readiness
        ↓
09  Present to Financing Destination
        ↓
10  Financing Decision
        ↓
11  Active Portfolio Monitoring
        ↓
12  Green / Financial Performance
        ↓
13  Verification / VVB Review
        ↓
14  Verified Findings
        ↓
15  Portfolio / Investor View
        ↓
16  Assurance / Reporting
```

The first eight stages demonstrate the **beachhead**.

Stages 9–16 demonstrate the **infrastructure potential**.

---

# 3. SCREEN FLOW

## Screen 01 — Entry / Role Selection

### Purpose

Immediately establish that Symphony serves multiple institutional actors.

### Roles

* SME / Cooperative
* PFI / Investor
* TA / Programme
* VVB / Independent Verifier
* Portfolio / Donor

The role selector is a demo convenience.

The underlying model must not imply that role equals organizational identity.

### Visual message

> One infrastructure. Multiple institutional perspectives.

---

# 4. SME JOURNEY

## Screen 02 — Organization Establishment

Create the cooperative.

Display:

* legal identity;
* registration;
* location;
* responsible officers;
* membership;
* organization status.

The organization exists independently of financing.

Important visual statement:

> **No bank. No programme. No loan required.**

---

# 5. Screen 03 — Project Establishment

This is a critical screen.

Create:

**2027 Climate-Smart Maize Production & Aggregation**

Capture:

* project name;
* location;
* participating members;
* area;
* activity;
* season;
* project category;
* baseline information.

The Project exists before a financing Arrangement.

This demonstrates an important architectural distinction without explaining it verbally.

---

# 6. Screen 04 — Current State

The SME begins with a fragmented state.

Show:

### Organization

* registration;
* governance;
* members;
* financial records.

### Project

* activity;
* land/field;
* production;
* environmental baseline;
* assets;
* operating records.

Each item has a state.

For example:

```text
Registration       ASSERTED
Governance         PARTIAL
Membership         PARTIAL
Financial records  SUPPORTED
Project baseline   SUPPORTED
Environmental data ASSERTED
```

The dashboard should visibly communicate:

> **This organization is economically real but not yet sufficiently established for institutional assessment.**

---

# 7. Screen 05 — Requirements Context

This is where Symphony becomes substantially different from an ordinary SME-management application.

Select:

**Assessment destination: PFI A**

The system presents the applicable requirements.

Example:

```text
PFI A

Organization requirements
✓ Registration
✓ Governance
✓ Membership
✓ Financial records

Project requirements
✓ Project definition
✓ Production history
✓ Environmental baseline
✓ Water/resource information

Financing requirements
○ Offtake
○ Financial history
○ Project economics
```

Every requirement should show:

* source;
* applicability;
* current state;
* evidence;
* limitation;
* outstanding action.

---

# 8. Screen 06 — Requirements → Evidence → Finding

This is the core Symphony interaction.

Click a requirement.

Example:

**Registration current**

Display:

```text
Requirement
Registration must be current.

Applicability
Applicable to this organization.

Evidence
Registration certificate

Evidence status
Supported

Verification
Field verification completed

Finding
Requirement satisfied

Limitation
Registrar database not independently queried.

Current state
Verified
```

The interface should make the chain visible:

```text
Requirement
     ↓
Applicability
     ↓
Evidence
     ↓
Verification
     ↓
Finding
     ↓
State
```

This is more important than the metric card itself.

---

# 9. Screen 07 — Gap / Remediation

Click:

**Governance requirement — unresolved**

Display:

```text
GAP

Current state:
Partially established

Requirement:
Governance decisions must be supported by records.

Missing:
2 unsigned meeting records

Owner:
Secretary

Required action:
Upload meeting minutes

Verification:
Chairman confirmation
+
independent verification

[Resolve Gap]
```

When the user resolves it, the prototype visibly animates:

```text
Evidence submitted
        ↓
Confirmation
        ↓
Verification
        ↓
Finding updated
        ↓
Requirement satisfied
        ↓
Readiness state updated
```

This is the **state-transition demonstration**.

---

# 10. Screen 08 — Assessment Readiness

The central screen.

Display:

```text
ASSESSMENT READINESS

Chisamba Farmers Cooperative
2027 Climate-Smart Maize Project

Destination
PFI A

────────────────────────────

Requirements       11
Satisfied           11
Open gaps            0
Limitations          2

ASSESSMENT READY
```

But critically, the user can click:

**Why?**

This opens the Readiness Basis.

---

# 11. Screen 09 — Readiness Basis

Display:

```text
WHY IS THIS PROJECT ASSESSMENT READY?

11 applicable requirements

11 satisfied

Each determination is traceable to:

Requirement
↓
Applicability
↓
Evidence
↓
Verification / Finding
↓
Current State
```

Then allow drill-down.

The PFI can therefore see **how** the readiness state was established rather than simply receiving a score.

At the bottom:

> Assessment Ready does not constitute financing approval.

---

# 12. Screen 10 — Destination Projection

This should be one of the major judging moments.

Switch destination.

### PFI A

```text
11 applicable
11 satisfied

ASSESSMENT READY
```

### PFI B

```text
9 applicable
7 satisfied
2 unresolved

NOT YET READY
```

The underlying organization/project state has not changed.

Only the destination requirement context changed.

The interface should explicitly state:

> **Same enterprise. Same project. Different requirement context.**

This visually communicates that readiness is not a universal SME score.

---

# 13. Screen 11 — Present to Destination

The cooperative chooses:

**Present to PFI A**

Symphony creates a destination-scoped presentation.

Show:

* organization;
* project;
* satisfied requirements;
* findings;
* evidence;
* limitations;
* unresolved matters;
* history.

The destination receives an assessable state.

Symphony does not make the financing decision.

---

# 14. PFI / INVESTOR JOURNEY

## Screen 12 — PFI Assessment Workspace

The PFI receives the presented case.

Display:

```text
Assessment Received

Organization
Project
Requirements
Evidence
Findings
Limitations
History
```

The PFI can:

* accept evidence;
* reject evidence;
* request additional evidence;
* independently verify;
* create its own finding;
* approve;
* decline;
* defer.

The critical distinction:

> **Symphony established the state. The PFI makes the institutional decision.**

---

# 15. Screen 13 — Financing Decision

For the demo:

```text
PFI DECISION

Assessment:
Complete

Decision:
APPROVED

Facility:
Sustainable Agriculture Finance

Status:
ACTIVE
```

This should be deliberately lightweight.

The prototype does not need to become a full banking core.

The purpose is to establish the transition:

```text
Assessment Ready
       ↓
Institutional Decision
       ↓
Active Financing Relationship
```

---

# 16. PORTFOLIO MONITORING JOURNEY

This is where the Kula Capital capability should become visible **without being explained as “the Kula Capital model.”**

## Screen 14 — Portfolio Dashboard

PFI / investor sees:

```text
GREEN PORTFOLIO

24 Active Projects

18 On Track
4 Attention Required
2 Verification Due

Portfolio exposure
Green outcomes
Open exceptions
Upcoming reporting
Verification status
```

Map:

```text
● On Track
● Attention
● Verification Required
● Exception
```

Clicking a project returns to the same governed project state.

---

# 17. Screen 15 — Active Project Monitoring

The same project now has a post-financing state.

Display:

### Financial

* disbursement;
* use of proceeds;
* repayment;
* financial performance.

### Operational

* production;
* activity;
* assets;
* milestones.

### Green

* environmental baseline;
* current environmental measurements;
* resource use;
* green milestones;
* impact indicators.

### Compliance

* reporting;
* covenants;
* exceptions;
* expiry;
* required reviews.

The important visual message:

> **The state established before financing does not disappear after financing. It becomes the baseline against which continuing performance is monitored.**

---

# 18. Screen 16 — Baseline vs Current State

This is a major green-economy demonstration.

Example:

```text
PROJECT ENVIRONMENTAL STATE

                BASELINE       CURRENT

Cultivated area   180 ha        190 ha
Water use         baseline      current
Land condition    baseline      current
Production        baseline      current
Environmental
observations      baseline      current
```

The interface should show:

**what changed, when, based on what evidence, and who established it.**

This turns the environmental feature into something much more significant than a GPS photograph.

It demonstrates:

> **baseline → measurement → monitoring → finding**

---

# 19. Screen 17 — Green Claim / Outcome

A green outcome can be selected.

For example:

**Water-efficiency milestone**

The interface shows:

```text
CLAIM

Water-use efficiency improved

Evidence
Sensor / field record

Baseline
[record]

Current
[record]

Calculation
[metric]

Verification
Pending

Status
UNVERIFIED
```

This is deliberately important.

The system must **not** immediately call the claim verified.

---

# 20. VVB JOURNEY

## Screen 18 — Verification Queue

Switch to:

**VVB / Independent Verifier**

Display:

```text
VERIFICATION QUEUE

Project                       Status

Chisamba Cooperative          READY
Solar SME Project             EVIDENCE REVIEW
Water Project                 EXCEPTION
Waste Project                 VERIFIED
```

This demonstrates that the architecture accommodates an independent actor.

---

# 21. Screen 19 — VVB Workbench

Open Chisamba.

The VVB sees:

```text
VERIFICATION ASSIGNMENT

Claim:
Water-efficiency milestone

Scope:
2027 Project Monitoring Period

Evidence available:
✓ Baseline
✓ Current measurement
✓ Field records
✓ Supporting photographs
✓ Calculation

Limitations:
1 outstanding data limitation
```

The VVB does not edit the SME's underlying evidence.

It performs its own verification function.

---

# 22. Screen 20 — VVB Finding

VVB chooses:

```text
FINDING

Verified
Partially verified
Not verified
Unable to determine
```

For example:

```text
VERIFIED

Finding:
Claim supported within defined scope.

Basis:
3 evidence items
2 field observations

Limitation:
Verification does not establish
financial performance.

Verifier:
VVB Organization
Authorized Verification Function

Date:
...
```

This demonstrates:

**external verification without collapsing verification into the underlying evidence.**

---

# 23. Screen 21 — Assurance Chain

This should be a visually powerful screen.

```text
GREEN OUTCOME

CLAIM
Water-efficiency improvement
        ↓
EVIDENCE
Field + sensor records
        ↓
ASSESSMENT
Project monitoring finding
        ↓
VVB VERIFICATION
Verified within scope
        ↓
INSTITUTIONAL RELIANCE
Accepted by PFI
        ↓
PORTFOLIO REPORTING
Green outcome included
```

This is one of the strongest demonstrations of Symphony's broader architecture.

---

# 24. Screen 22 — Portfolio Green-Economy View

The portfolio manager sees:

```text
GREEN PORTFOLIO

Projects                  24
Active                    21
Monitoring current        18
Verification current      16
Exceptions                 3

Green outcomes

Water                     ███████
Energy                    █████
Waste                     ████
Climate resilience        ███████
Agriculture               █████████
```

Click any metric and drill back into the projects and evidence supporting it.

The critical feature:

> **Portfolio-level information remains traceable back to project-level state and evidence.**

That is much stronger than an ESG dashboard.

---

# 25. Screen 23 — Multi-Sector Demonstration

Use a small number of seeded projects to demonstrate versatility.

Example portfolio:

| Organization        | Project                     | Green domain        |
| ------------------- | --------------------------- | ------------------- |
| Farmers Cooperative | Climate-smart agriculture   | Agriculture         |
| Solar SME           | Productive-use solar        | Clean energy        |
| Water Enterprise    | Community water system      | Water resilience    |
| Recycling SME       | Agricultural waste recovery | Circular economy    |
| Urban SME           | Efficient building          | Greener communities |

The user can switch between them.

The application structure remains the same:

```text
Organization
Project
Requirements
Evidence
State
Findings
Monitoring
Verification
```

Only the project-specific requirements and measurements change.

This is the best way to demonstrate breadth without building five separate products.

---

# 26. Screen 24 — Portfolio Exception View

The portfolio manager clicks:

**Attention Required**

and sees:

```text
WHY?

Project
Solar SME

Requirement
Quarterly energy-performance evidence

Current state
Evidence overdue

Last evidence
30 Jun 2026

Required action
Upload July–September record

Owner
Project operator

Verification
Pending
```

This demonstrates that portfolio monitoring is **state-driven**, rather than a collection of manually maintained spreadsheets.

---

# 27. Screen 25 — Expiry / Change Detection

Show one project where something changes.

Example:

```text
REGISTRATION

Previously:
VERIFIED

Current:
EXPIRED

Effective:
01 Oct 2026

Impact:
3 destination requirements affected

Portfolio status:
ATTENTION REQUIRED
```

The system propagates the state change into:

* project status;
* requirements;
* portfolio;
* reporting;
* verification queues where applicable.

This is a very strong demonstration of the value of maintaining governed state over time.

---

# 28. Screen 26 — Executive / Donor View

The donor/investor does not need all operational detail.

Show:

```text
PORTFOLIO

24 enterprises
31 projects

Assessment Ready
21

Financed
18

Monitoring Current
16

Verification Current
14

Open Material Exceptions
3
```

Every number is clickable.

For example:

**18 Financed**

→ projects

→ project state

→ evidence

→ findings

→ verification.

This demonstrates aggregation without losing traceability.

---

# 29. DATA & STATE MODEL

The prototype should use a deliberately small but architecturally meaningful mock data model.

## Organization

```text
id
name
type
location
registration
status
participants
```

---

## Project

```text
id
organization_id
name
sector
location
description
baseline
status
```

A Project exists independently of financing.

---

## Arrangement

Used only once the institutional relationship exists.

Examples:

```text
Programme Participation
Financing Facility
Verification Assignment
Service / TA Arrangement
```

---

## Participation

Connects an organization to an Arrangement.

---

## Participation Function

Examples:

```text
Borrower
Financier
Programme Participant
Verifier
Recipient
```

---

## Requirement

```text
id
source
version
description
type
```

---

## Interpretation / Applicability

```text
requirement_id
project_id / organization_id
applicability
reason
effective_period
```

---

## Evidence

```text
id
type
source
created_by
created_at
project_id
organization_id
provenance
status
```

---

## Evidence Admission

For the prototype:

```text
evidence_id
recipient
purpose
admission_status
limitation
```

This allows the same evidence to have different treatment by different institutional actors.

---

## Claim

```text
id
subject
statement
evidence[]
status
```

---

## Finding

```text
id
assessment
requirement
claim/evidence
result
performed_by
scope
limitations
```

---

## Reliance

```text
finding_id
relying_organization
purpose
status
```

---

## Institutional Decision

```text
organization
project
decision
authority
date
basis
```

---

## Monitoring Event

```text
project
metric
baseline
current_value
period
evidence
status
```

---

## Verification Assignment

```text
project
claim
scope
VVB
period
status
```

---

## Verification Finding

```text
assignment
finding
scope
limitations
verifier
status
```

---

## Portfolio

```text
portfolio
owner
projects[]
status
```

---

# 30. STATE MODEL

The prototype should demonstrate several different state dimensions rather than one universal status.

## Evidence state

```text
ASSERTED
SUPPORTED
VERIFIED
DISPUTED
STALE
```

## Requirement state

```text
NOT ASSESSED
APPLICABLE
UNRESOLVED
SATISFIED
EXCEPTION
```

## Assessment state

```text
IN PROGRESS
READY
PRESENTED
UNDER ASSESSMENT
```

## Financing state

```text
NOT FINANCED
APPROVED
ACTIVE
CLOSED
```

## Monitoring state

```text
CURRENT
DUE
OVERDUE
EXCEPTION
```

## Verification state

```text
NOT REQUIRED
PENDING
IN REVIEW
VERIFIED
PARTIALLY VERIFIED
NOT VERIFIED
```

These states should **not** be collapsed into one universal enterprise status.

---

# 31. COMPONENT BREAKDOWN

## 31.1 Governed Metric Card

Keep the existing component.

But upgrade it to show:

* current state;
* basis;
* evidence;
* verification;
* limitation;
* history.

---

## 31.2 State Transition Card

New core component.

Shows:

```text
Previous state
      ↓
Action
      ↓
Evidence
      ↓
Verification
      ↓
New state
```

This should be used throughout the prototype.

---

## 31.3 Requirement Card

Displays:

* requirement;
* source;
* applicability;
* state;
* evidence;
* finding;
* limitation.

---

## 31.4 Evidence Drawer

Shows:

* evidence;
* provenance;
* creator;
* timestamp;
* status;
* verification;
* admission;
* limitations.

---

## 31.5 Readiness Basis Panel

Shows exactly why a case is Assessment Ready.

---

## 31.6 Destination Switcher

Allows:

```text
PFI A
PFI B
Donor Programme
NABII
```

and recalculates the visible requirement context.

---

## 31.7 Gap / Remediation Panel

Shows:

* requirement;
* deficiency;
* owner;
* action;
* evidence required;
* deadline;
* resulting state.

---

## 31.8 Project State Timeline

One timeline containing:

```text
Project created
Baseline established
Evidence captured
Finding made
Assessment Ready
Financing decision
Monitoring event
Verification
```

This communicates continuity.

---

## 31.9 Portfolio Health Card

Displays:

* number of projects;
* readiness;
* monitoring;
* exceptions;
* verification.

---

## 31.10 Green Outcome Card

Shows:

```text
Baseline
Current
Change
Evidence
Verification
Status
```

---

## 31.11 Verification Workbench

VVB-specific interface showing:

* assignment;
* scope;
* evidence;
* claims;
* limitations;
* finding;
* verification decision.

---

## 31.12 Traceability Drawer

A universal:

**“How was this established?”**

interaction.

This may become one of the signature Symphony UI elements.

---

# 32. DEMO DATA DESIGN

The seed data should deliberately demonstrate different states.

### Project 1 — Hero

Rural agricultural cooperative.

Status:

**Assessment Ready → Financed → Monitoring → VVB verification**

This is the complete journey.

### Project 2 — Readiness Gap

Agricultural SME.

Status:

**Partially Ready**

### Project 3 — Monitoring Exception

Solar project.

Status:

**Financed → Monitoring Exception**

### Project 4 — Verification

Waste/circular-economy project.

Status:

**Financed → Green Claim → VVB Verification**

### Project 5 — Water Resilience

Water project.

Status:

**Assessment / monitoring**

### Project 6 — Greener Community

Urban/green-building project.

Status:

**Portfolio monitored**

This allows Challenge 5's breadth to be visible without building separate applications.

---

# 33. THE FOUR-MINUTE JUDGING JOURNEY

The prototype should ultimately support one extremely tight narrative.

## Act 1 — The problem

Start with:

> **“A green enterprise can be economically real without being institutionally assessable.”**

Show the cooperative.

```text
Organization exists
Project exists
Evidence fragmented
Requirements unclear
Assessment impossible
```

---

## Act 2 — Symphony

Create the project.

Establish the baseline.

Apply destination requirements.

Close one important gap.

Show:

```text
NOT READY
      ↓
READINESS BASIS
      ↓
ASSESSMENT READY
```

---

## Act 3 — Destination

Switch PFI.

Show:

```text
Same project.
Different requirements.
Different assessment state.
```

Then show the PFI making its own decision.

---

## Act 4 — Green Economy

Jump forward in time.

The same project is now financed.

Show:

```text
Baseline
     ↓
Monitoring
     ↓
Green outcome
     ↓
Evidence
```

---

## Act 5 — Independent assurance

Switch to VVB.

Show:

```text
Claim
 ↓
Evidence
 ↓
Verification
 ↓
Finding
```

---

## Act 6 — Scale

Switch to portfolio.

Show:

```text
24 projects
5 green sectors
18 financed
16 monitoring current
14 verification current
```

Click a portfolio number.

Drill all the way back to the underlying project evidence.

Then end with:

> **“The application changed because the use case changed. The infrastructure underneath it did not.”**

---

# 34. WHAT THE JUDGES SHOULD INFER

We should deliberately avoid explaining all of these verbally.

The prototype should allow judges to infer:

### From the SME journey

Symphony can transform institutional readiness.

### From destination projection

Readiness is contextual.

### From the PFI view

Symphony does not replace institutional decision-making.

### From monitoring

The state continues after financing.

### From green outcomes

Environmental performance can be tied to evidence and baselines.

### From VVB

Independent verification can operate on the same governed evidence/state infrastructure.

### From portfolio

Individual projects can aggregate into institutional oversight.

### From multi-sector projects

The architecture is not agriculture-specific.

### From traceability

Portfolio-level claims can be traced back to underlying evidence.

That is the versatility demonstration.

---

# 35. WHAT NOT TO BUILD FOR THE HACKATHON

The prototype should **simulate breadth, not implement an entire banking, ESG or verification system.**

Do not build:

* real loan processing;
* real credit underwriting;
* a complete accounting system;
* full VVB accreditation;
* real regulatory integrations;
* full IoT infrastructure;
* full carbon-credit certification;
* full ESG reporting standards;
* complete portfolio-management software.

Instead, build the **governed transitions and traceability** that make those applications possible.

---

# 36. IMPLEMENTATION ROADMAP

## Phase 0 — Prototype Contract

Freeze:

* prototype theme;
* judging narrative;
* actors;
* hero journey;
* state vocabulary;
* seed data;
* explicit demo boundaries.

**Output:** approved prototype specification.

---

## Phase 1 — Design System

Build the reusable visual primitives:

* navigation;
* status indicators;
* Governed Metric Card;
* Requirement Card;
* Evidence Drawer;
* State Transition Card;
* timeline;
* traceability interaction.

**Review gate:** UI communicates governed state rather than ordinary document management.

---

## Phase 2 — Organization + Project

Implement:

```text
Login
→ Organization
→ Project
→ Current State
```

Demonstrate self-onboarding and Project creation without an Arrangement.

**Review gate:** organization and project are correctly distinct.

---

## Phase 3 — Requirements + Readiness

Implement:

```text
Requirements
→ Applicability
→ Evidence
→ Findings
→ Gaps
→ Remediation
→ Assessment Ready
```

Implement destination switching.

**Review gate:** same project can produce different readiness outcomes for different destinations.

---

## Phase 4 — Evidence Governance

Implement the visible evidence chain:

```text
Evidence
→ Provenance
→ Verification
→ Limitation
→ History
```

Add the:

**How was this established?**

interaction.

**Review gate:** no state appears magically; every important state has a visible basis.

---

## Phase 5 — Destination Assessment

Implement:

```text
Present to PFI
→ PFI workspace
→ independent assessment
→ decision
```

**Review gate:** Symphony does not appear to make the financing decision.

---

## Phase 6 — Post-Financing Monitoring

Implement:

```text
Approved
→ Active
→ Baseline
→ Monitoring
→ Exception
```

Show the project state continuing after financing.

**Review gate:** pre-financing state and post-financing monitoring visibly connect.

---

## Phase 7 — Green Outcomes

Implement:

```text
Baseline
→ Current measurement
→ Green claim
→ Evidence
→ Verification status
```

Use the agriculture project as the primary example.

Then add a few different sector seed projects.

**Review gate:** green functionality appears requirement/state driven rather than a collection of environmental widgets.

---

## Phase 8 — VVB

Implement:

```text
Verification Queue
→ Assignment
→ Evidence Review
→ Finding
→ Verified / Partial / Not Verified
```

The VVB should have a separate institutional perspective.

**Review gate:** independent verification is clearly distinct from evidence generation and institutional decision-making.

---

## Phase 9 — Portfolio

Implement:

```text
Portfolio
→ Project list
→ Health
→ Exceptions
→ Green outcomes
→ Verification
→ Drill-down
```

Every aggregate should drill back to project-level state.

**Review gate:** portfolio information is traceable.

---

## Phase 10 — Multi-Sector Demonstration

Add seeded projects covering:

* agriculture;
* energy;
* water;
* circular economy;
* greener communities.

Do not create separate applications.

**Review gate:** the same underlying interaction model works across project types.

---

## Phase 11 — Judging Flow


Pre-seed all data except the actions that demonstrate transformation.

Prepare:

* reset demo;
* hero cooperative;
* PFI A;
* PFI B;
* financed project;
* VVB assignment;
* portfolio;
* exception.

**Review gate:** complete story can be demonstrated without explaining the architecture first.

---

# 37. FINAL PRODUCT ARCHITECTURE TO BE SHOWN BY THE PROTOTYPE

The prototype should ultimately make this visible:

```text
                         SYMPHONY
                             │
              GOVERNED GREEN-ECONOMY STATE
                             │
       ┌─────────────────────┼──────────────────────┐
       │                     │                      │
       ▼                     ▼                      ▼
   ENTERPRISE             PROJECT              INSTITUTION
       │                     │                      │
       └──────────────┬──────┴──────────────┬───────┘
                      ▼                     ▼
                REQUIREMENTS            EVIDENCE
                      │                     │
                      └──────────┬──────────┘
                                 ▼
                           FINDINGS / STATE
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                             ▼
             READINESS                     MONITORING
                  │                             │
                  ▼                             ▼
             FINANCING                     GREEN OUTCOMES
                  │                             │
                  └──────────────┬──────────────┘
                                 ▼
                              VVB
                                 │
                                 ▼
                            ASSURANCE
                                 │
                                 ▼
                              PORTFOLIO
```

The key is that this should **not look like eight applications bolted together**.

It should look like **one infrastructure expressing different institutional workflows over the same governed state.**

---

# 38. PROTOTYPE SUCCESS CRITERION

The prototype succeeds if a judge can watch the demonstration and independently conclude:

> “This starts by making an SME assessable for finance, but the underlying system is actually capable of maintaining a governed record of the enterprise and project through financing, environmental monitoring, independent verification and portfolio reporting.”

And, importantly:

> “They haven't built separate software for each use case. The same underlying infrastructure is producing all of them.”

That is the versatility story.

---

# 39. GREENCODE ALIGNMENT

The current GreenCode Zambia brief explicitly asks for technology-enabled solutions combining environmental and economic development challenges, and Challenge 5 focuses on greener, more efficient and resilient cities and communities. It specifically includes environmental monitoring, greener buildings, energy and water efficiency, urban waste management, environmental-risk mapping and digital services.

The proposed prototype therefore uses **agriculture as the hero case**, but the multi-sector seeded projects demonstrate that the infrastructure can extend naturally into the Challenge 5 domains.

This also satisfies one of the brief's important tests:

> **Could the solution grow beyond one user or one community?**

The prototype's answer is demonstrated rather than asserted:

**one enterprise → one project → multiple institutional actors → multiple projects → multiple green sectors → portfolio.**

---

# 40. IMPLEMENTATION STOP POINT

No code should be written until this plan is approved.

The next implementation step, after approval, should be to freeze the **screen inventory, state transitions, seed-data graph and four-minute judging path** before any UI implementation begins.
