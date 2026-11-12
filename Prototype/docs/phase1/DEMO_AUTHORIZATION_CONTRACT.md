# Phase 1 demo operation authorization contract

**Contract:** `phase1-demo-authorization-v1`  
**Status:** Narrow server-side demo authority contract owner-approved (approval assumed at user direction, 2026-11-07); actor/tenant provisioning details and API proof remain pending.
**Authority:** ADR-016; Phase 1 remediation plan v2 WP0.6 and runtime profile matrix.

`VITE_DEMO` is presentation/build gating only. It never authorizes a server operation. A demo reset is a narrow server-side fixture operation, scoped to one designated synthetic demo tenant and explicitly configured demo actor(s). Authorization derives from authenticated server context and validated runtime configuration. The operation cannot call `purge:seed`, accept caller-supplied tenant IDs outside the designated tenant, alter another tenant, inherit ordinary staff/admin authority, or execute in real-data/staging/production profiles. Unknown, missing or contradictory mode configuration denies before mutation. Demo credentials and configuration are managed server-side; demo data is synthetic and visibly distinguished from real cooperative records.

WP0 pure policy vectors now prove the configured actor/tenant positive case, production/real-data/unknown-synthetic/forged-claim/wrong-actor/wrong-tenant/purge-operation denials. The deployment actor and tenant values remain explicit required configuration inputs; they have not been provisioned. The test profile itself disables demo controls; the distinct `demo` profile may enable only the configured actor/tenant. Purge is a separate service and role. Live API enforcement, row-change assertions and UI behavior belong to WP6.2; no route is authorized until those server checks exist.
