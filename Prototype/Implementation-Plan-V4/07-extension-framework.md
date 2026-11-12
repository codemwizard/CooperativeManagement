# 07 — Extension Framework: operational, ESG and evidence-quality modules

The business model depends on the cooperative being fully specified across **compliance, governance, operational and ESG/evidence-quality metrics**. V4 implements the cooperative compliance and governance core first. This document defines how everything else is specified now and picked up later **without rewriting or redesigning the model**.

## 1. Guarantees that prevent redesign

| Guarantee | Mechanism |
|---|---|
| New metric = data, not schema | `indicator_definitions`, `indicator_observations`, `indicator_calculations` are generic; a new indicator is a row plus a rule version |
| New module = registration, not surgery | `domain_modules` registry; every module plugs into the same kernel (commands, events, evidence, findings, authorisation, privacy) |
| Every metric is evidence-linked | An observation must reference evidence versions; standing comes from `computeStanding`, so assurance classes flow through automatically |
| Versioned definitions | Definitions, weights and calculation specs are versioned; calculations are immutable runs with `definitions_fingerprint` (the EQS pattern) |
| Visible gaps, never silent gaps | Each module has a `capability_registry` entry (`not_implemented` → `specified` → `in_progress` → `available`); screens show the CapabilityGap chip |
| Additive migrations only | Extension work adds tables/columns with defaults; no destructive changes after Gate 1 |
| Same privacy path | New data classes declare field sensitivity once; masking and consent apply automatically |

## 2. Module contract (the "domain pack")

Every module ships these artefacts. A module is `specified` when items 1–4 are done and `available` when all are.

| # | Artefact | Content |
|---|---|---|
| 1 | `spec.md` | Purpose, scope, non-goals, anti-inference guardrails, REQ ids, sources, open decisions |
| 2 | `catalogue.json` | Requirement definitions, indicator definitions, evidence classes, Duty Matrix rows, legal sources (with validation status) |
| 3 | Model | Tables only if the generic ones are insufficient (and then additive) |
| 4 | Rules | Versioned validation rules (finding ids), calculation specs |
| 5 | Commands and events | Added to the kernel catalogue |
| 6 | Projections | Read models for the workspace |
| 7 | UI panel | Components using existing primitives |
| 8 | Features | Gherkin scenarios tagged to the module's REQ ids |
| 9 | Fixtures | Synthetic data for tests |
| 10 | Capability entry | Status, owner, last updated |

## 3. Development path for any module (stages)

| Stage | Name | Output | Gate |
|---|---|---|---|
| S0 | Declare | Registry entry, owner, `not_implemented`, one-paragraph scope | Listed in UI as capability gap |
| S1 | Specify | `spec.md` with requirements, guardrails, sources | Founder-reviewed; open decisions listed |
| S2 | Source | Legal/standard sources catalogued (IRIS+ codes where relevant, Act sections), each with validation status and reviewer | Programme manager reviewed or flagged |
| S3 | Define | `catalogue.json`: indicators, evidence classes, applicability rules, stale windows | Schema-validated; no migration needed |
| S4 | Rule | Validation rules and calculation spec; table tests | Rules deterministic and versioned |
| S5 | Calculate | Pure calculation in `packages/domain`; oracle fixtures; fingerprints | Reproducible; mutation-tested |
| S6 | Present | Projection and UI panel via `presentEvidence` and presenters | a11y and language gates |
| S7 | Calibrate | Constants ratified or calibrated against field data; `[PROVISIONAL]` flags removed | Governance committee ratification |
| S8 | Enforce | Optional blocking modes where an organisation or programme wants them | Policy-configured, never code |

At every stage the module can ship partially: S3 alone already lets the Overview show "requirements defined, not yet evidenced".

## 4. Indicator framework (data model)

| Table | Purpose |
|---|---|
| `domain_modules` | id, name, pillar (compliance, governance, operational, esg), status, spec reference |
| `indicator_definitions` | code, module, pillar, nature (safeguard/asset), unit, applicability rule, evidence requirement, stale window, source standard (e.g. IRIS+ code), calculation spec ref, version, status |
| `indicator_observations` | organisation, definition version, period, value, evidence_version_ids, standing snapshot reference, recorded_by, stage |
| `indicator_calculations` | immutable run: method version, inputs fingerprint, definitions fingerprint, outputs, exceptions |
| `indicator_inputs` (adapter registry) | declares which projections feed each indicator, so an indicator can be re-bound when the model changes |

The existing EQS run identity (`input_fingerprint`, `definitions_fingerprint`, `calculation_id`) is adopted as is. The deferred "persistent evaluation event store" and "historical input snapshot reproduction" are delivered by `indicator_calculations` (WP-7.2).

## 5. Where today's content lands

### 5.1 Compliance and governance (Phases 2–6, fully implemented)

Enrolment, identity, by-laws, requirements, governance, meetings, committees, audit, education, annual return, evidence lifecycle and verification.

### 5.2 Evidence-quality measures

| Item | Today | V4 path |
|---|---|---|
| EQS (10-indicator register, 4 active: E1, S1, G1, G3) | Computed from legacy case JSON; `EQS-V1-PROVISIONAL` | Kept as is. Input adapters read relational projections; fixture tests prove outputs identical to legacy. The six specification-only indicators (E2, E3, S2, S3, S4, G2) become `specified` catalogue rows with capability gaps |
| Symphony ESG Index (illustrative; 9 indicators, 35/35/30 weights, tiers A–D) | Computed from case data and `data/esg_index.json` | Kept as is, wrapped by the same adapter pattern. Not merged with EQS until the founder decides how the two registers converge (see `08`) |

### 5.3 Operational module (specified now, built later)

Operational evidence is the data a lender or programme needs about how the cooperative actually works. It uses Track C (claims) and Track R (records) unchanged: supply → support → verified, with assurance classes.

| Candidate area | Typical evidence | Standing path | Notes |
|---|---|---|---|
| Membership and participation | Member register, attendance | R (register), C (member data) | Overlaps S1; PII rules apply |
| Production and seasons | Farming history, yields, inputs | C with field-agent observation | Seasonality drives stale windows |
| Sales and delivery | Delivery ledgers, buyer receipts, offtake agreements | R + X (buyer documents) | Financier design: offtake gap |
| Cash flow and finances | Statements, mobile-money/bank statements | R (Treasurer duty) + X | Treasurer duty process |
| Assets and livestock | Asset inventory, livestock counts | C with observation | Goat example in `03b` |
| Projects and financing use | Project plan, use of proceeds, covenants | R + institutional records | Phase 8 |

Each area becomes a module entry (S0) now, with `spec.md` and `catalogue.json` written when the founder prioritises it. No schema change is required to add any of them.

### 5.4 ESG/impact module

IRIS+-aligned indicators (the legacy ESG Index and EQS use IRIS+ labels) are registered with `source_standard`. Environmental (land tenure, water, practices), social (inclusion, safeguarding, register currency) and governance indicators follow the same path S0–S8. Anti-inference guardrails from the EQS specification (§1.3) are mandatory fields on every indicator definition.

## 6. Backlog seed (what exists to pick up)

| ID | Module | Item | Stage | Source |
|---|---|---|---|---|
| X-01 | EQS | E1 land tenure, S1 register currency, G1 statutory standing, G3 executive continuity | S6 (legacy), re-bind in Phase 7 | EQS spec §3 |
| X-02 | EQS | E2, E3, S2, S3, S4, G2 | S1 (spec only) | EQS spec §2 |
| X-03 | EQS | Provisional constants ratification or calibration | S7 | EQS spec §6 |
| X-04 | EQS | Persistent evaluation store, historical snapshot reproduction | S5 | EQS spec §5.2 |
| X-05 | ESG Index | Nine illustrative indicators and tiering | S6 (legacy) | `data/esg_index.json` |
| X-06 | ESG/EQS | Convergence of the two registers under one evidence-quality framework | S1 | `08` §5 |
| X-07 | Operational | Six candidate areas in §5.3 | S0 | `03b`, legacy case data |
| X-08 | Compliance | Annual return content (board list, membership and capital, audited statements) | S3 | notes supplied by founder; validate |
| X-09 | Governance | Statutory catalogue (board terms, committee disqualification, audit appointment) | S2 | legal review required |

## 7. Definition of "ready to pick up"

A future engineer or analyst can start a module with: the registry entry, `spec.md` skeleton, `catalogue.json` schema, the stage checklist above, a fixture builder, and a worked example (the test indicator from WP-7.2). No domain-model decisions remain open for the kernel; only module-specific decisions listed in the module's `spec.md`.
