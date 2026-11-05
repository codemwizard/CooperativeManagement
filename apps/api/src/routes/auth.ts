/**
 * @symphony/api — routes/auth.ts
 *
 * Fastify authentication routes (ENR-010, INV-021).
 *
 * Routes:
 *   POST /auth/login          — Zod-validated { userId, credential, deviceId }
 *                               Returns { sessionToken, forcedChangeRequired }
 *                               No credential in response body.
 *
 *   POST /auth/change-password — Zod-validated { userId, currentCredential, newPassword }
 *                                Credential fields are redacted in receipt.
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   - Input validated with Zod (no `any` types)
 *   - Credentials never logged or included in response bodies
 *   - Errors use typed codes
 *   - No plaintext credential in command receipts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService, type IssuedCredential } from '@symphony/domain/identity/auth-service';
import { randomBytes } from 'node:crypto';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const LoginBodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  credential: z.string().min(1, 'credential is required'),
  deviceId: z.string().min(1, 'deviceId is required'),
});

const ChangePasswordBodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  currentCredential: z.string().min(1, 'currentCredential is required'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters'),
});

// ─── In-memory credential store (Phase 1 stub — replaced by DB in Phase 2) ───

/**
 * Ephemeral in-memory store for issued credentials.
 * Phase 1 only — a real store backed by the DB is wired in Phase 2.
 */
export const credentialStore = new Map<string, IssuedCredential>();

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function authRoutes(
  fastify: FastifyInstance,
  options: { clock?: { now(): string } } = {},
): Promise<void> {
  const wallClock = options.clock ?? { now: () => new Date().toISOString() };
  const authService = new AuthService(wallClock);

  /**
   * POST /auth/login
   * Body: { userId, credential, deviceId }
   * Response 200: { sessionToken, forcedChangeRequired }
   * Response 401: { code, message }
   */
  fastify.post(
    '/auth/login',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = LoginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        await reply.status(400).send({ code: 'INVALID_REQUEST', errors: parsed.error.issues });
        return;
      }

      const { userId, credential, deviceId } = parsed.data;

      // Retrieve stored credential for this user
      const stored = credentialStore.get(userId);
      if (stored === undefined) {
        await reply.status(401).send({ code: 'INVALID_CREDENTIAL', message: 'No credential on file' });
        return;
      }

      const result = await authService.verifyCredential(userId, credential, stored, deviceId);

      if (!result.ok) {
        const statusCode = result.code === 'TEMPORARY_CREDENTIAL_EXPIRED' ? 401
          : result.code === 'CREDENTIAL_ALREADY_USED' ? 401
          : 401;
        await reply.status(statusCode).send({ code: result.code });
        return;
      }

      // Generate a session token (Phase 1 — not persisted; Phase 2 wires session store)
      const sessionToken = randomBytes(32).toString('base64url');

      // No credential in response
      await reply.status(200).send({
        sessionToken,
        forcedChangeRequired: result.forcedChangeRequired,
      });
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

      // Issue a new permanent credential (hashed)
      const newIssued = await authService.issueTemporaryCredential(userId, 24 * 365);
      // In Phase 1 we re-hash the user-supplied password via argon2
      // The new hash replaces the stored temp credential
      const argon2 = await import('argon2');
      const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      newIssued.used = false; // reset for new credential

      // Store the receipt with credentials redacted (INV-021)
      const receipt = authService.buildChangePasswordReceipt(userId, { currentCredential, newPassword });

      // Update the in-memory store with the new credential
      credentialStore.set(userId, { ...newIssued, hash: newHash });

      await reply.status(200).send({ ok: true, receipt: receipt.payload });
    },
  );
}
