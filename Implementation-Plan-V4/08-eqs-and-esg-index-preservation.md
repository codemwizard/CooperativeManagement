# 08 — ESG Index and EQS: preservation record

Decision (ADR-004, 3 November 2026): **keep the ESG Index and the Evidence Quality Score (EQS) as they are.** Both are evidence-quality measures. Neither is an ESG performance score as the term is used commercially. This note records how they work today and where they are heading, so nothing is lost when the model moves to a database. No file listed here is edited by the V4 work; changes happen only through the adapter layer (`07` §5.2) and are proven by fixture parity.

## 1. What exists (inventory)

| Artefact | Role | Read for this note |
|---|---|---|
| `docs/EQS_METHODOLOGY_SPECIFICATION.md` (`EQS-V1-PROVISIONAL`, 17 Oct 2026) | Authoritative EQS methodology | Read in full |
| `data/esg_index.json` | Configuration of the illustrative Symphony ESG Index | Read in full |
| `data/iris_mapping.json`, `src/engine/eqs.ts`, `src/engine/esg.ts`, `EqsCard` component, EQS tests and fixtures | Implementations and tests (named in README, decisions and the traceability matrix) | **Not read**; named from documentation only |

## 2. How EQS works today (from the specification)

- **Measures** four things: provenance depth (asserted → supported → verified), referential integrity (consistency of claims, artefacts, assignments, findings), currency and freshness, and contradiction state (disputes, discrepancies, unresolved findings).
- **Does not measure:** conventional ESG performance, credit risk or solvency, or independent assurance/audit.
- **Anti-inference guardrails** (mandatory disclosure beside any score): tenure, roster, registration and resolution guardrails.
- **Register:** ten canonical indicators (E1, E2, E3, S1, S2, S3, S4, G1, G2, G3). Four are active in the prototype slice (E1 land tenure, S1 member register currency, G1 legal statutory standing, G3 executive continuity and resolution), each weight 25. Six are specification-only and excluded from runtime scoring.
- **Mathematics:** composite is the weighted mean of earned points over evaluable indicators; absence taxonomy (`neutral_exclusion`, `safeguard_positive`, `safeguard_failure`, `declared_absent`, `not_applicable`) decides denominators; pillars can be unevaluable; the scorecard publishes pillar coverage and exceptions.
- **Identity:** `input_fingerprint`, `definitions_fingerprint` and `calculation_id` (SHA-256 over canonical JSON) make calculations reproducible.
- **Delivery boundary:** pure calculation, stable identity and fingerprints are implemented; the persistent evaluation event store and historical snapshot reproduction are **deferred**.
- **Provisional constants** (all `[PROVISIONAL]`, to be ratified or calibrated): stale roster over 90 days; asserted 0.25; supported 0.65 (0.45 with discrepancy); verified with qualifications 0.85; unresolved conflict cap 0.30; roster discrepancy threshold 10%; unverified roster cap 0.25; officers without AGM resolution cap 0.50; AGM resolution window 24 months.
- **Trust boundary:** the browser envelope checksum detects accidental corruption only; it is not an audit trail.

## 3. How the Symphony ESG Index works today (from `esg_index.json`)

Illustrative proprietary methodology, labelled for prototype use and aligned to the IRIS+ taxonomy. Three pillars with weights: Environmental 0.35 (sustainable practices, water security, land use), Social 0.35 (smallholder reach, gender inclusion, youth-led households), Governance 0.30 (member roster integrity, AGM minutes recorded, discrepancy transparency). Tier thresholds: A at 80, B at 60, C at 40, D at 0. It is explicitly illustrative.

## 4. How they relate

Two registers exist side by side: the EQS ten-indicator register (evidence-quality, with guardrails and calculation identity) and the nine-indicator ESG Index (illustrative weights and tiers). Both are evidence-quality measures per the founder's ruling. They have not been converged; convergence is backlog item X-06 and needs a founder decision.

## 5. Where they are heading

**Stated in the sources:**
1. Activate the six specification-only EQS indicators.
2. Ratify or calibrate every provisional constant against field data.
3. Deliver the persistent evaluation event store and historical snapshot reproduction.
4. "Fully fleshed out later" as an evidence-quality measure (founder, 3 Nov 2026).

**Proposed by this plan (for your decision):**
5. Read inputs from relational projections through adapters (WP-7.4), with fixture parity to legacy outputs.
6. Make provenance-depth scoring assurance-aware. Today "verified" means independent third-party confirmation in the EQS text; V4 distinguishes cooperative-internal, platform, independent and institutional findings. A future `EQS-V2` could weight them differently. V4 keeps `EQS-V1` unchanged by treating any verified level as verified, and displays the assurance class beside the result.
7. Converge the EQS and ESG Index registers under one evidence-quality framework (X-06).
8. Keep every score surface labelled: "Evidence-quality measure, not an ESG performance rating" (C10). The no-score rule applies to readiness surfaces, not to this labelled panel.

## 6. Errata to resolve with the legal reviewer (documentation only, nothing changed)

| Item | Observation |
|---|---|
| Registration terminology | The EQS text refers to PACRA registration and an annual PACRA return (G1 and the registration guardrail). Cooperatives register with the Registrar of Co-operative Societies; PACRA is the companies agency. The cooperative specification also treats annual returns as separate from the certificate and says the certificate does not expire |
| G1 stale window | "Annual PACRA return" conflicts with the cooperative specification's rule that certificate expiry is not modelled |
| G3 window | 24 months for AGM resolution is a provisional constant, not a legal rule |
| Statutory sources | Any citation in EQS or catalogue content must carry the instrument and version (the 1998 Act and 1999 Regulations are the in-force sources per `02` §6 C7) and a validation status |

These are recorded here so the EQS document stays untouched while the correction decision is taken.

## 7. Preservation rules for V4

1. `docs/EQS_METHODOLOGY_SPECIFICATION.md` and `data/esg_index.json` are not modified by V4 work. New methodology versions are new documents.
2. Legacy EQS/ESG tests and fixtures stay in the legacy suite until retirement; equivalent adapter tests are added in Phase 7 and must produce identical outputs on the legacy fixtures.
3. Any change to constants or indicators requires a new methodology version string and a decision record.
4. The captions and anti-inference guardrails travel with every presentation of either measure.
