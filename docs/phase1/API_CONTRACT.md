# Phase 1 shared HTTP/API contract

**Contract:** `phase1-http-api-v1`  
**Status:** Owner-approved WP0 baseline (approval assumed at user direction, 2026-11-07); API/browser implementation and contract tests remain pending.  
**Authority:** Phase 1 remediation plan v2 §1, WP0.9/WP0.10/WP5; `03-specification-delta.md` §§3.1, 9; `04-architecture.md` §§3, 5; features 01/02/09/10; current route code is evidence of the mismatch, not normative authority.

## Rules shared by browser, API and command facade

1. `packages/contracts` is the single source of versioned request/response schemas and inferred TypeScript types. API validates untrusted input with Zod; the workspace imports the same contract. No duplicate hand-maintained DTOs or `as`-casts at an API boundary.
2. Authenticated actor, tenant, role, capacity, appointment and delegation context are resolved server-side. Client-supplied actor/tenant/role/approval/standing fields are rejected or ignored according to the command schema and never grant authority.
3. JSON objects are strict: unknown fields fail validation, defaults are materialized before semantic digest, and malformed/duplicate-key input is rejected before normal JSON parsing for command hashing.
4. Every response has a classified result/error code and a documented HTTP status. A validation error does not echo secrets or raw request bodies. Logs/events/receipts contain no credentials, tokens or raw member PII.
5. Logical `correlation_id` is not interchangeable with request/trace correlation. `recorded_at` is server generated. Command metadata semantics are those in `COMMAND_TRANSACTION_CONTRACT.md`.
6. Browser acceptance must use the actual workspace server, actual API composition and PostgreSQL-backed test user. It must not intercept/mock `/auth/login` or report static `page.setContent()` as a route/API pass.

## Authentication routes

The current API route accepts `POST /auth/login` JSON `{ userId, credential, deviceId }`; the current workspace sends `{ email, password }`. WP5 must remove that mismatch by making both sides consume one shared contract. The v1 login request preserves the API's source-compatible field names `userId`, `credential`, `deviceId`; the UI may label the field “Email or user ID” but serializes it as `userId`. Reject unknown fields and do not reflect field values in error output.

Login success returns `forcedChangeRequired` and establishes an opaque server-side session using an `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookie. HTTPS is required outside local development. Do not return a bearer session token in the JSON body, URL, or persistent browser storage. State-changing requests require a synchronizer CSRF token and valid Origin. Rotate/create a session after login and on privilege or tenant change. Logout revokes the current session; password change revokes all sessions. These WP0.10 values are owner-approved by direction of 2026-11-07. Login failure uses a stable typed error envelope; it must not reveal whether an account exists. Current detail text “No credential on file” is not the final external error contract.

`POST /auth/change-password` requires an authenticated session. The target user ID is derived from that session, never trusted from the body. The body contains only current credential proof if required by policy and the new password; it is strict and redacted in traces. Success atomically clears forced-change status, revokes all existing sessions, and requires a new login. Until forced change succeeds, only password change, logout, session/CSRF support, and essential authentication endpoints are allowed. The password policy and concrete bounded rate-limit algorithm must be sourced/recorded before WP5; do not invent a value or permanent lockout.

## Command API

Command writes use the shared versioned `CommandEnvelope` contract based on `03` §9 and the receipt contract. Client fields include command ID, organization/target, occurred time, device metadata when required, expected version, declared logical correlation metadata, command type/schema version and typed payload. Actor identity is injected from authenticated server context; server `recorded_at` is generated at acceptance. Tenant context is derived/validated by the server and database transaction. A generic command route and offline batch endpoint must be documented before WP1.6; do not invent an endpoint path in an adapter and call it the shared contract.

The response distinguishes committed success, same-actor replay, deterministic terminal rejection (including stale conflict), retryable service/audit failure and non-disclosing key-reuse denial. Only committed safe results are replayable. A conflict may expose an opaque reconciliation reference, never raw preserved values. Exact schemas are ratified with WP0.1 and emitted from `packages/contracts`; no response body can set a trusted status or authority.

The complete session/forced-change route allowlist, exact-expiry semantics, CSRF/Origin requirements and session-revocation rules are in [`AUTHENTICATION_CONTRACT.md`](AUTHENTICATION_CONTRACT.md) §WP0.10. The frozen forced-change allowlist is `GET /auth/csrf`, `GET /auth/session`, `POST /auth/change-password`, and `POST /auth/logout`; every other application/API route is denied. `POST /auth/login` remains public only for unauthenticated clients and cannot bypass a forced-change session restriction.

## Required contract tests

- API and workspace import the same schema/types; compile-time and runtime tests reject incompatible payloads.
- `userId/credential/deviceId` is the one login request representation; tests fail on an `email/password` duplicate DTO.
- Login response contains no credential and no session token in body; browser/API tests assert cookie attributes and CSRF/Origin behavior.
- Unauthenticated, invalid, forced-change, expired and revoked cases use the published status/code map; user-existence details are not disclosed.
- Change password cannot target another account by body field and cannot proceed without the permitted session state.
- Command actor/tenant/role are server-derived; forged client fields cannot authorize.
- Browser-to-API acceptance proves the API received and handled the request using server-side correlation evidence; no mocked login route.

The WP0.10 session values are approved. The route-level schemas and error/status map must now be made concrete in `packages/contracts` before WP5 implementation; password policy and the bounded rate-limit algorithm remain sourced implementation inputs, not permission to let API and UI drift or choose security values ad hoc.
