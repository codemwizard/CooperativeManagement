# Symphony Proprietary Evidence Quality Score (EQS) Methodology Specification
**Document ID:** `SYMPHONY-EQS-METHODOLOGY-SPEC-V1-PROVISIONAL`  
**Governing Document:** `Prototype_Baseliner.md` · Baseline Specification §4.3 · V14 Remediation Plan  
**Methodology Version Contract:** `EQS-V1-PROVISIONAL`  
**Date:** 17 October 2026  
**Status:** Authorized Specification & Provisional Prototype Implementation  

---

## 1. Scope, Boundaries, and Anti-Inference Principles

### 1.1 What EQS Measures
The Evidence Quality Score (EQS) is a derived, read-only evaluation of governed operational records captured natively through Symphony workflows. It measures:
1. **Provenance Depth:** The progression of claims through the operational lifecycle from uncorroborated assertion (`asserted`), to document-backed corroboration (`supported`), to independent third-party confirmation (`verified`).
2. **Referential Integrity:** The cryptographic consistency and non-repudiation of claims, supporting artefacts, verifier assignments, and findings.
3. **Currency & Freshness:** The temporal validity of recorded evidence against stated expiration windows.
4. **Contradiction State:** The absence or presence of active disputes, discrepant observations, or unresolved adverse findings.

### 1.2 What EQS Explicitly Does NOT Measure
1. **Not a Conventional ESG Performance Score:** EQS does not evaluate whether a cooperative has low carbon emissions, pristine biodiversity, or progressive labor policies. It measures solely the *quality and verifiable provenance of evidence* submitted regarding these matters.
2. **Not a Credit Risk or Solvency Rating:** High evidence quality does not imply borrower creditworthiness, financial profitability, or repayment capability.
3. **Not Independent Assurance or Audit:** EQS is an internal scoring engine calculating derived metrics; it does not substitute for statutory accounting audits or regulatory accreditations.

### 1.3 Anti-Inference Guardrails
Every indicator evaluation enforces mandatory anti-inference guardrails that must be disclosed to institutional viewers alongside any score presentation:
- *Tenure Guardrail:* Land occupancy rights confirmation verifies legal tenure, but does not infer soil fertility, rainfall adequacy, or crop yield.
- *Roster Guardrail:* Active roster enumeration verifies cooperative standing, but does not infer member solvency or loan repayment willingness.
- *Registration Guardrail:* Statutory PACRA registration confirms corporate existence, but does not guarantee ongoing commercial solvency or absence of unrecorded encumbrances.
- *Resolution Guardrail:* Executive AGM resolution minutes verify governance authorization, but do not infer operational management execution ability.

---

## 2. Canonical 10-Indicator Register

The governing baseline (`CONSOLIDATED_IMPLEMENTATION_PLAN.md §4.3`) establishes exactly 10 candidate indicators across the Environmental, Social, and Governance pillars. No additional indicators are recognized.

| Code | Pillar | Name | Nature | Native Source Fields | Status | Applicable Population | Stale Window |
|---|---|---|---|---|---|---|---|
| **E1** | Environmental | Land Tenure Evidencing | Safeguard | `evidence.land_right` (level, scope, valid_until) | **Active Slice** | All agricultural cooperatives | `valid_until < evalDate` |
| **E2** | Environmental | Water Resource Security | Safeguard | `evidence.water_source`, `project.irrigated` | Specification Only | Irrigated farming projects | Annual renewal |
| **E3** | Environmental | Sustainable Practice Coverage | Asset | `evidence.environmental_baseline` | Specification Only | Climate-smart practices | 24 months |
| **S1** | Social | Member Register Currency | Safeguard | `members_roster`, `evidence.member_register` | **Active Slice** | All registered cooperatives | [PROVISIONAL] >90 days |
| **S2** | Social | Gender Disaggregation Evidencing | Safeguard | `members_roster[*].gender` completeness | Specification Only | All member rosters | Annual enumeration |
| **S3** | Social | Youth Inclusion Evidencing | Safeguard | `members_roster[*].age` completeness | Specification Only | All member rosters | Annual enumeration |
| **S4** | Social | Child Safeguarding Safeguards | Safeguard | `evidence.social_safeguards` | Specification Only | Cooperatives with family labor | Annual signoff |
| **G1** | Governance | Legal Statutory Standing | Safeguard | `evidence.registration`, `pacra_number` | **Active Slice** | All legal cooperative societies | Annual PACRA return |
| **G2** | Governance | AGM Regularity & Quorum | Safeguard | `governance.meetings` (attendance, minutes) | Specification Only | All active cooperatives | 15 months since AGM |
| **G3** | Governance | Executive Continuity & Resolution | Safeguard | `officers`, `evidence.governance` (AGM minutes) | **Active Slice** | All applicant cooperatives | 24 months for resolution |

---

## 3. Four-Indicator Active Prototype Slice

To validate the engine without premature over-specification, the prototype implements an active vertical slice consisting of exactly four indicators:
- **E1 (Environmental):** Customary Land Tenure & Communal Use Rights (Weight: 25)
- **S1 (Social):** Member Register Currency & Active Participation (Weight: 25)
- **G1 (Governance):** Legal Statutory Standing & Regulatory Compliance (Weight: 25)
- **G3 (Governance):** Executive Resolution Backing & Borrowing Mandate (Weight: 25)

The remaining six indicators (E2, E3, S2, S3, S4, G2) are specification-only and are strictly excluded from runtime production score computation.

---

## 4. Denominator & Evaluability Mathematics

### 4.1 Composite Formula
Let $A$ be the set of active indicators with applicability state 'evaluable'. Let $w_i$ and $p_i$ be the weight and earned raw points for indicator $i \in A$:

$$S_{\text{composite}} = \frac{\sum_{i \in A} p_i \cdot w_i}{\sum_{i \in A} w_i} \times 100$$

If $A$ is empty (all criteria excluded or inapplicable):
- $S_{\text{composite}} = \text{null}$
- `unevaluable_composite = true`
- Grade = `'N/A'`
- Exception emitted: `DATA_ABSENT_ALL_PILLARS`

### 4.2 Denominator Rules
1. **Asset Criterion Demonstrably Absent (`absence_evidenced`):** Excluded from applicable denominator ($\sum w_i$ decreases). No penalty. Informational note emitted.
2. **Asset Criterion Claimed Absent Unverified (`declared_absent`):** Retained in denominator with 0 earned points ($p_i = 0$). Warning exception emitted (`UNVERIFIED_ABSENCE`).
3. **Absence Taxonomy & Denominator Semantics:**
   - **Neutral Exclusion (`neutral_exclusion`):** Demonstrably absent and independently verified ($p_i = 0.0$, weight excluded from denominator). Applies to tenure models or inoperable asset criteria where absence does not constitute non-compliance.
   - **Safeguard Positive (`safeguard_positive`):** Evidenced absence of a harmful condition verifiably corroborated ($p_i = 1.0$, weight retained in denominator).
   - **Safeguard Failure (`safeguard_failure`):** Required control or statutory authorization confirmed absent ($p_i = 0.0$, weight retained in denominator). Emits critical failure exception (`ABSENT_REQUIRED_<CODE>`).
   - **Unsubstantiated Absence (`declared_absent`):** Absence claimed by management without independent corroboration ($p_i = 0.0$, weight retained in denominator). Emits warning exception (`UNVERIFIED_ABSENCE_<CODE>`).
4. **Safeguard Criterion Missing or Unverified:** Retained in denominator with 0 earned points ($p_i = 0$). Warning/critical exception emitted.
5. **Genuinely Inapplicable (`not_applicable`):** Excluded from applicable denominator without penalty.

### 4.3 Pillar Evaluability
For each pillar $P \in \{\text{Environmental}, \text{Social}, \text{Governance}\}$:
- If applicable count in pillar $P = 0$:
  - `evaluable = false`
  - `score = 0` (rendered as `"Unevaluable — no applicable criteria for this case"`)
  - Exception emitted: `DATA_ABSENT_PILLAR_<P>`
  - Contributes 0 to numerator and 0 to denominator of composite score.
- The scorecard publishes `pillar_coverage_ratio` (e.g. `'2/3'`).

---

## 5. Calculation Identity & Delivery Boundary

### 5.1 Identity Contracts
Calculation identity is strictly separated from evaluation event logging:
- `input_fingerprint`: SHA-256 over canonical JSON (RFC 8785) of score-relevant input fields only:
  - `case_id`, `methodology_version`, `eval_date`
  - `definitions_fingerprint`: Canonical SHA-256 over active indicator codes, weights, criterion natures, and absence outcomes
  - `evidence.*` (level, version_id, conflict_state, valid_until, history)
  - `members_roster`
  - `officers`
  - `verification.findings` (result, assignment_id, basis, qualifications)
  - `registration_number` / `pacra_number`
- `calculation_id`: SHA-256 over canonical representation of `{ case_id, methodology_version, input_fingerprint, definitions_fingerprint }`.

### 5.2 Delivery Boundary Declarations
- Pure calculation reproducibility: **Implemented and verified.**
- Stable calculation identity: **Implemented and verified.**
- Input fingerprint covering score-relevant fields: **Implemented and verified.**
- Persistent evaluation event store: **Deferred.**
- Historical input snapshot reproduction: **Deferred.**

---

## 6. Provisional Constants & Calibration Register

All values below are prototype design decisions labelled `[PROVISIONAL]`. Before production deployment, each parameter must either be formally ratified by the Governance Committee or re-calibrated against empirical field data.

| Parameter | Provisional Value | Rationale / Prototype Assumption |
|---|---|---|
| **Stale Member Roster Threshold** | > 90 days since `supplied_on` | Agricultural cooperative seasonal roster update cycle |
| **Unverified Level Asserted Score** | 0.25 points | Acknowledges self-declaration while severely restricting credit |
| **Supported Level (No Discrepancy)** | 0.65 points | Corroborated by supporting document, pending independent query |
| **Supported Level (With Discrepancy)** | 0.45 points | Documented corroboration offset by observation discrepancy |
| **Verified With Qualifications** | 0.85 points | Independent verifier confirmed claim with noted scope limitation |
| **Unresolved Conflict Score Cap** | 0.30 points max | Active contradiction blocks promotion above 30% of criterion weight |
| **Roster Count Discrepancy Threshold** | > 10% variance vs `members` | Allows minor enumeration churn before flagging audit discrepancy |
| **Unverified Member Roster Cap** | 0.25 points max | Self-declared roster lacking field-agent verification event |
| **Officers Present Without AGM Resolution** | 0.50 points max | Committee exists but lacks formal AGM borrowing mandate |
| **AGM Resolution Expiration Window** | 24 months | Annual General Meeting borrowing mandate maximum duration |

---

## 7. Integrity Trust Boundary

The envelope SHA-256 checksum validates that stored data has not been accidentally corrupted between write and read within a browser session. It does not:
- Prevent a user who controls browser storage from altering data and recomputing the checksum.
- Constitute an independently authenticated or timestamped audit trail.
- Provide proof that the original field observation was accurate.

Claims about data integrity must be bounded by this trust model.
