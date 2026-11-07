# Phase 1 authentication and session policy contract

**Contract:** `phase1-authentication-v1`  
**Status:** Owner-approved security baseline (approval assumed at user direction, 2026-11-07); the existing domain credential policy now rejects exactly at the 72-hour boundary. Persistent session/API behavior remains assigned to WP5.
**Authority:** `03-specification-delta.md` §3.1 and ENR-010; ADR-005/018; Phase 1 WP0.8/WP0.10; existing auth tests are implementation evidence only, not policy approval.

| Policy item | Current source/known requirement | Required decision before WP5 |
|---|---|---|
| Temporary credential lifetime | 72 hours from server-side issuance, as approved under D-08 | No runtime/configuration override. Any future change requires a decision-register ruling and contract revision. Boundary tests at just-before, exactly-at, just-after. |
| Credential use | Single use, forced password change; source `03` §3.1/ENR-010 | Preserve source behavior and audit without recording plaintext |
| Session transport/cookie attributes | Opaque server-side session; no bearer token in browser local storage. Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; HTTPS outside local development. | Implement as stated; prove cookie/TLS behavior in browser and API tests |
| Origin and CSRF | Synchronizer token plus Origin validation for state-changing requests | Implement exact policy and negative origin/token tests |
| Logout and session rotation | Create/rotate on login and privilege/tenant changes; logout revokes current session | Prove prior session unusable after each rotation/revocation |
| Forced-change route allowlist | Only password change, logout, session/CSRF support, and essential authentication endpoints before change succeeds | Enumerate exact endpoints; deny all others through API composition |
| Password policy | Not specified by source in this decision package | Use existing product password policy only if sourced; otherwise record exact selected rule in a follow-up owner decision before WP5 password implementation |
| Brute-force/rate limits | Rate limit by account and source; progressive delay; generic failure response; no permanent lockout | Record concrete bounded algorithm/window and test repeated attempts without introducing permanent lockout |
| Idle and absolute session lifetime | 30-minute idle; 12-hour absolute; no “remember me” bypass | Boundary tests immediately before/at/after each limit |
| Password change revocation | Revoke all existing sessions and require a new login | Multi-session API/browser test proves global revocation |
| Concurrent sessions | Multiple sessions permitted, each with independent revocation | Prove revoking one session does not revoke another except on password change |

Temporary credentials expire exactly 72 hours after server-side issuance, are single-use, and force password change. The security settings in the table are owner-approved by direction of 2026-11-07. The password-policy details and concrete rate-limit algorithm remain implementation inputs requiring an explicit sourced rule before WP5 completes; do not use a test fixture or UI constraint as policy.

**WP0.8 evidence:** `packages/domain/src/identity/__tests__/auth.test.ts` proves the 72-hour boundary with an injected clock. The first run failed at the exact boundary because `AuthService` used a strict `>` comparison; changing the expiry predicate to `now >= expiresAt` made all seven focused auth tests pass. The database-backed account/session lifecycle remains a WP5 acceptance responsibility.

## WP0.10 exact session policy and forced-change route contract

The forced-change session allowlist is exact and method-sensitive:

| Method/path | Unauthenticated use | Forced-change session | CSRF/Origin |
|---|---|---|---|
| `GET /auth/csrf` | Issues a pre-auth synchronizer token needed for login | Allowed; refreshes the session-bound token | Safe read; same-origin response policy |
| `POST /auth/login` | Public login using the shared `userId`, `credential`, `deviceId` body | Denied for an already authenticated forced-change session | Require configured Origin and pre-auth synchronizer token |
| `GET /auth/session` | Denied without a session | Allowed; returns only authentication/forced-change state and a session-bound CSRF token | Safe read |
| `POST /auth/change-password` | Denied | Allowed; authenticated actor is derived from session | Require synchronizer token and valid Origin |
| `POST /auth/logout` | Denied | Allowed; revokes only the current session | Require synchronizer token and valid Origin |
| `GET /health/live`, `GET /health/ready` | Infrastructure-only endpoints; return no user/session data | Not subject to user session policy | No business mutation |
| Every other application/API route | Session policy applies | Denied with the stable forced-change-required error; no business command is accepted | Unsafe methods require synchronizer token and valid Origin |

The `/auth/csrf` and `/auth/session` endpoints return the synchronizer token only to the same-origin browser context; the browser holds it in memory and sends `X-CSRF-Token` on unsafe requests. Login rotates the pre-auth token into a new session-bound token. Successful password change revokes every session and requires a fresh login; privilege/tenant changes rotate the current session identifier and CSRF token. Logout revokes only the current session. Multiple concurrent sessions are permitted and independently revocable.

Session validity is `now < issued_at + 12 hours` **and** `now < last_activity_at + 30 minutes`; equality is expired. Temporary credential validity is `now < issued_at + 72 hours`; equality is expired. There is no remember-me override.

The accepted policy requires progressive delay by both account and source, generic failure responses, and no permanent account lockout. The supplied decision package does not define delay/window numbers or a password-complexity rule. Those are explicit WP5 implementation inputs and must be sourced/recorded before WP5 can pass; this contract does not select arbitrary security thresholds.
