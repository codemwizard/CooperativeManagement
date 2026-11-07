# WP0.8 credential-expiry boundary TDD

- Requirement: temporary credential expires exactly 72 hours after server-side issuance; source `03-specification-delta.md` §3.1 and ENR-010.
- Test: `packages/domain/src/identity/__tests__/auth.test.ts`, `temporaryCredential_expiresAtExact72HourBoundary`.
- Clock assertions: valid 1 ms before expiry; `TEMPORARY_CREDENTIAL_EXPIRED` exactly at expiry; same denial 1 ms after expiry.

## Red

Command: `node node_modules/vitest/vitest.mjs run --root packages/domain src/identity/__tests__/auth.test.ts`

Result: failed as expected. At the exact expiry timestamp, the service returned success because its comparison was `now > expiresAt`.

## Green

Changed the expiry condition to reject when `now >= expiresAt`.

Command: `node node_modules/vitest/vitest.mjs run --root packages/domain src/identity/__tests__/auth.test.ts`

Result: **passed**, all 7 focused authentication tests.

This proves the existing domain credential policy boundary. It does not claim persistence, API session, CSRF, or browser authentication behavior; those remain assigned to WP5.
