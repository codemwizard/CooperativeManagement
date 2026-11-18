/**
 * @symphony/api — routes/auth.ts
 *
 * Fastify authentication routes (ENR-010, INV-021).
 *
 * Routes:
 *   POST /auth/login          — Zod-validated { userId, credential, deviceId }
 *                               Returns { forcedChangeRequired }; no bearer token.
 *
 *   POST /auth/change-password — Zod-validated { userId, currentCredential, newPassword }
 *                                Legacy test adapter stores a separate permanent hash.
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   - Input validated with Zod (no `any` types)
 *   - Credentials never logged or included in response bodies
 *   - Errors use typed codes
 *   - No plaintext credential in command receipts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiErrorStatus, changePasswordRequestSchema, loginRequestSchema, loginSuccessSchema } from '@symphony/contracts';
import { AuthService, type IssuedCredential } from '@symphony/domain/identity/auth-service';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const ChangePasswordBodySchema = changePasswordRequestSchema.extend({ userId: z.string().min(1) });

// ─── Legacy route-test stores; the shipped server does not mount these routes ──

/**
 * Ephemeral in-memory store retained only by legacy route tests. The shipped
 * server stays unready until persisted WP5.3 session composition is wired.
 */
export const credentialStore = new Map<string, IssuedCredential>();
/** Legacy route-test adapter only; the shipped server uses the PostgreSQL repository. */
export const passwordCredentialStore = new Map<string, string>();

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function authRoutes(
  fastify: FastifyInstance,
  options: { clock?: { now(): string } } = {},
): Promise<void> {
  const wallClock = options.clock ?? { now: () => new Date().toISOString() };
  const authService = new AuthService(wallClock);
  const credentialLifecycle = new CredentialLifecycleService(wallClock);

  /**
   * POST /auth/login
   * Body: { userId, credential, deviceId }
   * Response 200: { forcedChangeRequired }
   * Response 401: { code, message }
   */
  fastify.post(
    '/auth/login',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = loginRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        await reply.status(apiErrorStatus.INVALID_REQUEST).send({ code: 'INVALID_REQUEST' });
        return;
      }

      const { userId, credential, deviceId } = parsed.data;

      // Retrieve stored credential for this user
      const stored = credentialStore.get(userId);
      if (stored === undefined) {
        await reply.status(apiErrorStatus.AUTHENTICATION_FAILED).send({ code: 'AUTHENTICATION_FAILED' });
        return;
      }

      const result = await authService.verifyCredential(userId, credential, stored, deviceId);

      if (!result.ok) {
        await reply.status(apiErrorStatus.AUTHENTICATION_FAILED).send({ code: 'AUTHENTICATION_FAILED' });
        return;
      }

      // Session cookies are added by REM-WP5.3; never return an unpersisted bearer token.
      await reply.status(200).send(loginSuccessSchema.parse({
        forcedChangeRequired: result.forcedChangeRequired,
      }));
    },
  );

  /**
   * POST /auth/change-password
   * Body: { userId, currentCredential, newPassword }
   * Response 200: { ok: true }
   * Response 401: { code }
   *
   * The command receipt stored in the audit log has credentials redacted.
   */
  fastify.post(
    '/auth/change-password',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = ChangePasswordBodySchema.safeParse(req.body);
      if (!parsed.success) {
        await reply.status(400).send({ code: 'INVALID_REQUEST', errors: parsed.error.issues });
        return;
      }

      const { userId, currentCredential, newPassword } = parsed.data;

      // Verify the current credential before allowing a change
      const stored = credentialStore.get(userId);
      if (stored === undefined) {
        await reply.status(401).send({ code: 'INVALID_CREDENTIAL' });
        return;
      }

      const verifyResult = await authService.verifyCredential(userId, currentCredential, stored, 'change-password');
      if (!verifyResult.ok) {
        await reply.status(401).send({ code: verifyResult.code });
        return;
      }

      // A permanent password is stored as its own credential type. Never turn
      // password establishment into a long-lived temporary credential.
      const newHash = await credentialLifecycle.hashPermanentPassword(newPassword);

      // Store the receipt with credentials redacted (INV-021)
      const receipt = authService.buildChangePasswordReceipt(userId, { currentCredential, newPassword });

      // These maps support legacy route tests only; production uses WP5.2's
      // transactional PostgreSQL credential repository.
      credentialStore.delete(userId);
      passwordCredentialStore.set(userId, newHash);

      await reply.status(200).send({ ok: true, receipt: receipt.payload });
    },
  );
}
