import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import {
  commandHttpRequestSchema,
  commandHttpResponseSchema,
  type CommandHttpRequest,
} from '@symphony/contracts';
import type {
  CommandBus,
  CommandEnvelope,
} from '@symphony/domain';
import type {
  AuthorityMutationAggregate,
} from '@symphony/db';
import type { AuthenticatedSessionContext } from '../authentication-composition.js';

type Handlers = ReturnType<typeof import('@symphony/db').createCapacityDelegationHandlers>;
export interface CommandRouteDependencies {
  readonly bus: CommandBus<AuthorityMutationAggregate>;
  readonly handlers: Handlers;
}

const BODY_LIMIT = 1_048_576;

/**
 * Installs a scoped raw-JSON parser and the single registered Phase 1 command
 * endpoint. Identity comes exclusively from the persisted auth session.
 */
export function createCommandRoutes(dependencies: CommandRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.removeContentTypeParser('application/json');
    fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
      try {
        done(null, parseStrictJson(body as Buffer));
      } catch {
        const error = new Error('Invalid JSON body') as Error & { statusCode: number; code: string };
        error.statusCode = 400;
        error.code = 'FST_ERR_CTP_INVALID_JSON_BODY';
        done(error);
      }
    });

    fastify.post<{ Body: unknown }>('/commands', { bodyLimit: BODY_LIMIT }, async (request, reply) => {
      reply.header('Cache-Control', 'no-store, private');
      const mediaType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
      if (mediaType !== 'application/json') {
        await reply.status(415).send({ code: 'UNSUPPORTED_MEDIA_TYPE' });
        return;
      }
      const session = request.authSession;
      if (!session) {
        await reply.status(401).send({ code: 'UNAUTHENTICATED' });
        return;
      }
      const parsed = commandHttpRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ code: 'INVALID_COMMAND' });
        return;
      }
      let response: { status: number; body: unknown };
      try {
        response = await dispatchCommand(dependencies, parsed.data, session);
      } catch {
        await reply.status(500).send({ ok: false, code: 'INTERNAL_ERROR' });
        return;
      }
      const checked = commandHttpResponseSchema.safeParse(response.body);
      if (!checked.success) {
        await reply.status(500).send({ ok: false, code: 'INTERNAL_ERROR' });
        return;
      }
      await reply.status(response.status).send(checked.data);
    });
  };
}

async function dispatchCommand(
  dependencies: CommandRouteDependencies,
  request: CommandHttpRequest,
  session: AuthenticatedSessionContext,
): Promise<{ status: number; body: unknown }> {
  const envelopeBase = {
    commandId: request.commandId,
    organizationId: request.organizationId,
    occurredAt: request.occurredAt,
    recordedAt: new Date().toISOString(),
    deviceId: request.deviceId ?? 'phase1-http',
    expectedVersion: request.expectedVersion ?? 0,
    correlationId: randomUUID(),
    schemaVersion: request.schemaVersion,
  };
  let result;
  switch (request.type) {
    case 'GrantCapacity': {
      const envelope: CommandEnvelope<typeof request.payload> = {
        ...envelopeBase, type: request.type, tenantId: session.tenantId,
        actorUserId: session.userId, payload: request.payload,
      };
      result = await dependencies.bus.dispatch(envelope, dependencies.handlers.GrantCapacity, {
        trustedPrincipal: { actorUserId: session.userId, tenantId: session.tenantId },
        aggregateId: request.payload.capacityGrantId,
      });
      break;
    }
    case 'RevokeCapacity': {
      const envelope: CommandEnvelope<typeof request.payload> = {
        ...envelopeBase, type: request.type, tenantId: session.tenantId,
        actorUserId: session.userId, payload: request.payload,
      };
      result = await dependencies.bus.dispatch(envelope, dependencies.handlers.RevokeCapacity, {
        trustedPrincipal: { actorUserId: session.userId, tenantId: session.tenantId },
        aggregateId: request.payload.capacityGrantId,
      });
      break;
    }
    case 'DelegateTaScope': {
      const envelope: CommandEnvelope<typeof request.payload> = {
        ...envelopeBase, type: request.type, tenantId: session.tenantId,
        actorUserId: session.userId, payload: request.payload,
      };
      result = await dependencies.bus.dispatch(envelope, dependencies.handlers.DelegateTaScope, {
        trustedPrincipal: { actorUserId: session.userId, tenantId: session.tenantId },
        aggregateId: request.payload.delegationId,
      });
      break;
    }
  }
  if (result.ok) {
    return { status: 200, body: {
      ok: true, aggregateVersion: result.aggregateVersion, eventIds: result.eventIds,
      data: result.data, replayed: result.replayed ?? false,
    } };
  }
  switch (result.code) {
    case 'IDEMPOTENCY_KEY_REUSED':
      return { status: 409, body: { ok: false, code: result.code, replayed: false } };
    case 'STALE_VERSION':
      return { status: 409, body: { ok: false, code: 'VERSION_CONFLICT', replayed: result.replayed ?? false } };
    case 'COMMAND_TEMPORARILY_UNAVAILABLE':
      return { status: 503, body: { ok: false, code: result.code, retryable: true } };
    case 'DOMAIN_VIOLATION':
      return { status: 409, body: { ok: false, code: 'DOMAIN_CONFLICT', replayed: result.replayed ?? false } };
    case 'UNAUTHORIZED':
    case 'TENANT_MISMATCH':
    case 'NOT_AUTHORISED_FOR_ORGANISATION':
    case 'PRECONDITION_FAILED':
    case 'NOT_FOUND':
      return { status: 403, body: { ok: false, code: 'NOT_AUTHORIZED', replayed: false } };
    default:
      return { status: 500, body: { ok: false, code: 'INTERNAL_ERROR' } };
  }
}

/** Reject duplicate decoded object keys and unpaired surrogate escapes before JSON.parse. */
export function parseStrictJson(raw: Buffer): unknown {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  let offset = 0;
  const whitespace = (): void => { while (/\s/.test(source[offset] ?? '') && offset < source.length) offset += 1; };
  const stringToken = (): string => {
    const start = offset;
    if (source[offset] !== '"') throw new SyntaxError('Expected JSON string');
    offset += 1;
    while (offset < source.length) {
      const character = source[offset]!;
      if (character === '"') {
        offset += 1;
        const value = JSON.parse(source.slice(start, offset)) as string;
        assertWellFormedUnicode(value);
        return value;
      }
      if (character === '\\') {
        offset += 1;
        if (source[offset] === 'u') offset += 5;
        else offset += 1;
      } else {
        if (character.charCodeAt(0) < 0x20) throw new SyntaxError('Control character in JSON string');
        offset += 1;
      }
    }
    throw new SyntaxError('Unterminated JSON string');
  };
  const value = (): void => {
    whitespace();
    const character = source[offset];
    if (character === '"') { stringToken(); return; }
    if (character === '{') {
      offset += 1; whitespace();
      const keys = new Set<string>();
      if (source[offset] === '}') { offset += 1; return; }
      while (true) {
        whitespace();
        const key = stringToken();
        if (keys.has(key)) throw new SyntaxError('Duplicate JSON object key');
        keys.add(key); whitespace();
        if (source[offset++] !== ':') throw new SyntaxError('Expected colon');
        value(); whitespace();
        const delimiter = source[offset++];
        if (delimiter === '}') return;
        if (delimiter !== ',') throw new SyntaxError('Expected object delimiter');
      }
    }
    if (character === '[') {
      offset += 1; whitespace();
      if (source[offset] === ']') { offset += 1; return; }
      while (true) {
        value(); whitespace();
        const delimiter = source[offset++];
        if (delimiter === ']') return;
        if (delimiter !== ',') throw new SyntaxError('Expected array delimiter');
      }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(offset));
    if (number) { offset += number[0].length; return; }
    for (const literal of ['true', 'false', 'null']) {
      if (source.startsWith(literal, offset)) { offset += literal.length; return; }
    }
    throw new SyntaxError('Invalid JSON value');
  };
  value(); whitespace();
  if (offset !== source.length) throw new SyntaxError('Trailing JSON content');
  return JSON.parse(source);
}

function assertWellFormedUnicode(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new SyntaxError('Unpaired high surrogate');
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new SyntaxError('Unpaired low surrogate');
  }
}
