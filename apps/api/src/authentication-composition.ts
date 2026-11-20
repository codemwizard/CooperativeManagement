import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { apiErrorStatus, changePasswordRequestSchema, loginRequestSchema, loginSuccessSchema } from '@symphony/contracts';
import { CredentialLifecycleService, PasswordCredentialPolicyError } from '@symphony/domain/identity/credential-lifecycle';
import { PostgresAuthSessionRepository } from '@symphony/db';
import type { AuthSessionRow, AuthSubject, LoginAttemptReservation } from '@symphony/db';
import type { ApiErrorCode } from '@symphony/contracts';
import type { ApiRuntimeConfig } from './runtime-config.js';

const COOKIE = 'symphony.sid';
const SESSION_IDLE_MS = 30 * 60_000;
const SESSION_ABSOLUTE_MS = 12 * 60 * 60_000;

export interface AuthenticatedSessionContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly forcedChangeRequired: boolean;
  readonly temporaryCredentialId: string | null;
  readonly tokenHash: Buffer;
}

declare module 'fastify' {
  interface FastifyRequest { authSession: AuthenticatedSessionContext | null; }
  interface FastifyInstance {
    /** Call only after the route has committed a privilege/tenant change. */
    rotateAuthSession(request:FastifyRequest,reply:FastifyReply):Promise<string|undefined>;
  }
}

function token(): string { return randomBytes(32).toString('base64url'); }
function hash(value: string): Buffer { return createHash('sha256').update(value).digest(); }
function readCookie(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const segment of header.split(';')) {
    const [name, ...value] = segment.trim().split('=');
    if (name === COOKIE && value.length > 0) return value.join('=');
  }
  return undefined;
}
function sendError(reply: FastifyReply, code: ApiErrorCode): void {
  void reply.status(apiErrorStatus[code]).send({ code });
}
function validSession(session: { issuedAt: string; lastActivityAt: string; absoluteExpiresAt: string; revokedAt: string | null }): boolean {
  const now = Date.now();
  return session.revokedAt === null
    && now < Date.parse(session.absoluteExpiresAt)
    && now < Date.parse(session.lastActivityAt) + SESSION_IDLE_MS
    && now < Date.parse(session.issuedAt) + SESSION_ABSOLUTE_MS;
}
function cookieValue(raw: string, config: ApiRuntimeConfig, maxAgeSeconds: number): string {
  const secure = config.appEnv !== 'development' && config.appEnv !== 'test' ? '; Secure' : '';
  return `${COOKIE}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}
function cookieClear(config: ApiRuntimeConfig): string { return cookieValue('', config, 0); }

export interface AuthCompositionOptions {
  readonly pool?: import('pg').Pool;
  /** Explicit store seam for tests; production composition supplies PostgreSQL. */
  readonly repository?: AuthSessionStore;
  readonly config: ApiRuntimeConfig;
  readonly throttleHmacKey: Buffer;
  readonly clock?: { now(): string };
}

export interface AuthSessionStore {
  lookupSubject(userId: string): Promise<AuthSubject | undefined>;
  findSession(tokenHash: Buffer): Promise<AuthSessionRow | undefined>;
  createPreAuthSession(tokenHash: Buffer, csrfHash: Buffer): Promise<void>;
  refreshCsrf(tokenHash: Buffer, csrfHash: Buffer, tenantId?: string): Promise<boolean>;
  createAuthenticatedSession(input: {preAuthTokenHash:Buffer;tokenHash:Buffer;csrfHash:Buffer;tenantId:string;userId:string;deviceId:string;temporaryCredentialId:string|null;forcedChangeRequired:boolean}): Promise<void>;
  touchSession(tokenHash: Buffer, tenantId: string): Promise<boolean>;
  revokeSession(tokenHash: Buffer, tenantId: string): Promise<void>;
  updatePermanentPasswordHash(tenantId:string,userId:string,passwordHash:string):Promise<void>;
  rotateAuthenticatedSession(input:{previousTokenHash:Buffer;nextTokenHash:Buffer;nextCsrfHash:Buffer;tenantId:string}):Promise<boolean>;
  establishPasswordAndRevokeSessions(input: {tenantId:string;userId:string;temporaryCredentialId:string;passwordHash:string}): Promise<void>;
  reserveAttempt(accountHmac: Buffer, sourceHmac: Buffer): Promise<LoginAttemptReservation>;
  finishAttempt(input: {attemptId:string;accountHmac:Buffer;sourceHmac:Buffer;success:boolean}): Promise<void>;
  abandonAttempt(input:{attemptId:string;accountHmac:Buffer;sourceHmac:Buffer}):Promise<void>;
  healthCheck(): Promise<boolean>;
}

export interface AuthComposition {
  readonly authentication: FastifyPluginAsync;
  verifyCsrf(request: FastifyRequest): Promise<boolean>;
  authorize(request: FastifyRequest): Promise<ApiErrorCode | undefined>;
  rotateSession(request: FastifyRequest, reply: FastifyReply): Promise<string | undefined>;
  healthCheck(): Promise<boolean>;
}

/** Production WP5.3 session/auth composition; no in-memory credential or session store. */
export function createAuthComposition(options: AuthCompositionOptions): AuthComposition {
  const repository: AuthSessionStore = (() => {
    const candidate = options.repository ?? (options.pool ? new PostgresAuthSessionRepository(options.pool) : undefined);
    if (!candidate) throw new Error('A PostgreSQL auth repository is required for authentication composition.');
    return candidate;
  })();
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const credentials = new CredentialLifecycleService(clock);
  const requestSessions = new WeakMap<FastifyRequest, AuthenticatedSessionContext>();
  let dummyHashPromise: Promise<string> | undefined;

  async function getValidSession(request: FastifyRequest) {
    const raw = readCookie(request);
    if (!raw) return undefined;
    const session = await repository.findSession(hash(raw));
    if (!session || !validSession(session)) return undefined;
    if (session.userId && session.tenantId) {
      if (!(await repository.touchSession(session.tokenHash, session.tenantId))) return undefined;
      return session;
    }
    return session;
  }

  const authentication: FastifyPluginAsync = async (fastify) => {
    dummyHashPromise ??= credentials.hashPermanentPassword('fixed unavailable account verification secret');
    await dummyHashPromise;
    fastify.get('/auth/csrf', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const rawCookie = readCookie(request);
      const oldSession = rawCookie ? await repository.findSession(hash(rawCookie)) : undefined;
      const csrfToken = token();
      if (rawCookie && oldSession && validSession(oldSession)) {
        const refreshed = await repository.refreshCsrf(oldSession.tokenHash, hash(csrfToken), oldSession.tenantId ?? undefined);
        if (refreshed) return { csrfToken };
      }
      const sessionToken = token();
      await repository.createPreAuthSession(hash(sessionToken), hash(csrfToken));
      reply.header('Set-Cookie', cookieValue(sessionToken, options.config, 12 * 60 * 60));
      return { csrfToken };
    });

    fastify.get('/auth/session', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const session = requestSessions.get(request);
      if (!session) { sendError(reply, 'UNAUTHENTICATED'); return; }
      const csrfToken = token();
      if (!(await repository.refreshCsrf(session.tokenHash, hash(csrfToken), session.tenantId))) {
        sendError(reply, 'UNAUTHENTICATED'); return;
      }
      return { authenticated: true, forcedChangeRequired: session.forcedChangeRequired, csrfToken };
    });

    fastify.post('/auth/login', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const parsed = loginRequestSchema.safeParse(request.body);
      if (!parsed.success) { sendError(reply, 'INVALID_REQUEST'); return; }
      const preAuth = await getValidSession(request);
      if (!preAuth || preAuth.userId !== null) { sendError(reply, 'CSRF_REJECTED'); return; }
      const { userId, credential, deviceId } = parsed.data;
      const accountHmac = createHmac('sha256', options.throttleHmacKey).update(`account:${userId.toLowerCase()}`).digest();
      const sourceHmac = createHmac('sha256', options.throttleHmacKey).update(`trusted_source:${request.ip}`).digest();
      const reservation = await repository.reserveAttempt(accountHmac, sourceHmac);
      if (reservation.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, reservation.delayMs));

      let subject;
      try {
        subject = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
          ? await repository.lookupSubject(userId)
          : undefined;
      } catch { subject = undefined; }
      let forcedChangeRequired = false;
      let temporaryCredentialId: string | null = null;
      let verified = false;
      let attemptedCredentialHash = false;
      if (subject?.passwordSecretHash) {
        attemptedCredentialHash = true;
        verified = await credentials.verifyPermanentPassword(credential, subject.passwordSecretHash);
        if (verified && credentials.needsPermanentPasswordRehash(subject.passwordSecretHash)) {
          const upgradedHash = await credentials.rehashPermanentPassword(credential);
          await repository.updatePermanentPasswordHash(subject.tenantId,userId,upgradedHash);
        }
      } else if (subject?.temporarySecretHash && subject.temporaryCredentialId && subject.temporaryExpiresAt) {
        const result = await credentials.verifyTemporaryCredential(credential, {
          credentialId: subject.temporaryCredentialId,
          hash: subject.temporarySecretHash,
          issuedAt: new Date(Date.parse(subject.temporaryExpiresAt) - 72 * 60 * 60_000).toISOString(),
          expiresAt: subject.temporaryExpiresAt,
        });
        attemptedCredentialHash = result !== 'expired';
        verified = result === 'valid';
        forcedChangeRequired = verified;
        temporaryCredentialId = verified ? subject.temporaryCredentialId : null;
      } else {
        // Keep unknown-account verification on the same Argon2id path.
        dummyHashPromise ??= credentials.hashPermanentPassword('fixed unavailable account verification secret');
        const dummyHash = await dummyHashPromise;
        await credentials.verifyPermanentPassword(credential, dummyHash);
        attemptedCredentialHash = true;
      }
      if (!attemptedCredentialHash) {
        dummyHashPromise ??= credentials.hashPermanentPassword('fixed unavailable account verification secret');
        await credentials.verifyPermanentPassword(credential, await dummyHashPromise);
      }
      if (!verified || !subject || subject.userStatus !== 'active') {
        await repository.finishAttempt({ attemptId: reservation.attemptId, accountHmac, sourceHmac, success: false });
        sendError(reply, 'AUTHENTICATION_FAILED'); return;
      }

      const nextToken = token(); const csrfToken = token();
      try {
        await repository.createAuthenticatedSession({
          preAuthTokenHash: preAuth.tokenHash, tokenHash: hash(nextToken), csrfHash: hash(csrfToken),
          tenantId: subject.tenantId, userId: userId.toLowerCase(), deviceId,
          temporaryCredentialId, forcedChangeRequired,
        });
      } catch {
        await repository.abandonAttempt({attemptId:reservation.attemptId,accountHmac,sourceHmac}).catch(()=>undefined);
        sendError(reply, 'COMMAND_TEMPORARILY_UNAVAILABLE'); return;
      }
      try {
        await repository.finishAttempt({ attemptId: reservation.attemptId, accountHmac, sourceHmac, success: true });
      } catch {
        await repository.revokeSession(hash(nextToken),subject.tenantId).catch(()=>undefined);
        await repository.abandonAttempt({attemptId:reservation.attemptId,accountHmac,sourceHmac}).catch(()=>undefined);
        sendError(reply, 'COMMAND_TEMPORARILY_UNAVAILABLE'); return;
      }
      reply.header('Set-Cookie', cookieValue(nextToken, options.config, 12 * 60 * 60));
      return loginSuccessSchema.parse({ forcedChangeRequired });
    });

    fastify.post('/auth/change-password', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const parsed = changePasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) { sendError(reply, 'INVALID_REQUEST'); return; }
      const session = requestSessions.get(request);
      if (!session || !session.forcedChangeRequired || !session.temporaryCredentialId) { sendError(reply, 'UNAUTHENTICATED'); return; }
      const subject = await repository.lookupSubject(session.userId);
      if (!subject?.temporarySecretHash || subject.temporaryCredentialId !== session.temporaryCredentialId || !subject.temporaryExpiresAt) {
        sendError(reply, 'AUTHENTICATION_FAILED'); return;
      }
      const validCurrent = await credentials.verifyTemporaryCredential(parsed.data.currentCredential, {
        credentialId: session.temporaryCredentialId,
        hash: subject.temporarySecretHash,
        issuedAt: new Date(Date.parse(subject.temporaryExpiresAt) - 72 * 60 * 60_000).toISOString(),
        expiresAt: subject.temporaryExpiresAt,
      });
      if (validCurrent !== 'valid') { sendError(reply, 'AUTHENTICATION_FAILED'); return; }
      let passwordHash: string;
      try { passwordHash = await credentials.hashPermanentPassword(parsed.data.newPassword); }
      catch (error) {
        if (error instanceof PasswordCredentialPolicyError) { sendError(reply, 'INVALID_REQUEST'); return; }
        sendError(reply, 'INTERNAL_ERROR'); return;
      }
      try {
        await repository.establishPasswordAndRevokeSessions({
          tenantId: session.tenantId, userId: session.userId,
          temporaryCredentialId: session.temporaryCredentialId, passwordHash,
        });
      } catch { sendError(reply, 'AUTHENTICATION_FAILED'); return; }
      reply.header('Set-Cookie', cookieClear(options.config));
      return { ok: true };
    });

    fastify.post('/auth/logout', async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const session = requestSessions.get(request);
      if (!session) { sendError(reply, 'UNAUTHENTICATED'); return; }
      await repository.revokeSession(session.tokenHash, session.tenantId);
      reply.header('Set-Cookie', cookieClear(options.config));
      return { ok: true };
    });
  };

  async function verifyCsrf(request: FastifyRequest): Promise<boolean> {
    const rawCookie = readCookie(request);
    const provided = request.headers['x-csrf-token'];
    if (!rawCookie || typeof provided !== 'string' || provided.length < 32) return false;
    const session = await repository.findSession(hash(rawCookie));
    if (!session || !validSession(session)) return false;
    const actual = hash(provided);
    return actual.length === session.csrfHash.length && timingSafeEqual(actual, session.csrfHash);
  }

  async function authorize(request: FastifyRequest): Promise<ApiErrorCode | undefined> {
    const path = request.url.split('?', 1)[0] ?? request.url;
    if (path === '/health/live' || path === '/health/ready') return undefined;
    const rawCookie = readCookie(request);
    const session = rawCookie ? await repository.findSession(hash(rawCookie)) : undefined;
    const valid = session && validSession(session);
    if (!valid || !session) {
      if (path === '/auth/csrf' || path === '/auth/login') return undefined;
      return 'UNAUTHENTICATED';
    }
    if (session.userId && session.tenantId && session.deviceId) {
      const active = await repository.touchSession(session.tokenHash, session.tenantId);
      if (!active) return 'UNAUTHENTICATED';
      const context: AuthenticatedSessionContext = {
        tenantId: session.tenantId, userId: session.userId, deviceId: session.deviceId,
        forcedChangeRequired: session.forcedChangeRequired,
        temporaryCredentialId: session.temporaryCredentialId, tokenHash: session.tokenHash,
      };
      request.authSession = context;
      requestSessions.set(request, context);
      if (session.forcedChangeRequired) {
        const allowed = (request.method === 'GET' && ['/auth/csrf','/auth/session'].includes(path))
          || (request.method === 'POST' && ['/auth/change-password','/auth/logout'].includes(path));
        if (!allowed) return 'FORCED_PASSWORD_CHANGE_REQUIRED';
      }
      if (path === '/auth/login' && session.forcedChangeRequired) return 'FORCED_PASSWORD_CHANGE_REQUIRED';
    } else if (path !== '/auth/csrf' && path !== '/auth/login') {
      return 'UNAUTHENTICATED';
    }
    return undefined;
  }

  async function rotateSession(request: FastifyRequest, reply: FastifyReply): Promise<string | undefined> {
    const session = requestSessions.get(request);
    if (!session) return undefined;
    const rawToken = token(); const csrfToken = token();
    const rotated = await repository.rotateAuthenticatedSession({
      previousTokenHash:session.tokenHash,nextTokenHash:hash(rawToken),nextCsrfHash:hash(csrfToken),tenantId:session.tenantId,
    });
    if (!rotated) return undefined;
    reply.header('Set-Cookie',cookieValue(rawToken,options.config,12*60*60));
    return csrfToken;
  }

  return { authentication, verifyCsrf, authorize, rotateSession, healthCheck: () => repository.healthCheck() };
}
