import Fastify, { type FastifyError, type FastifyInstance, type FastifyLoggerOptions, type FastifyPluginAsync, type FastifyReply, type FastifyRequest } from 'fastify';
import { apiErrorResponseSchema, apiErrorStatus, type ApiErrorCode } from '@symphony/contracts';
import type { ApiRuntimeConfig } from './runtime-config.js';

export interface ApiRouteComposition {
  readonly authentication?: FastifyPluginAsync;
  readonly commands?: FastifyPluginAsync;
  /** Session/pre-auth-token validation is supplied by the authentication composition. */
  verifyCsrf?(request: FastifyRequest): Promise<boolean>;
}

export interface ApiReadinessCheck {
  readonly name: string;
  check(): Promise<boolean>;
}

export interface ApiServerOptions {
  readonly config: ApiRuntimeConfig;
  readonly routes?: ApiRouteComposition;
  readonly readinessChecks?: readonly ApiReadinessCheck[];
  /** Optional destination used by deployment logging and deterministic redaction verification. */
  readonly logStream?: FastifyLoggerOptions['stream'];
}

function sendError(reply: FastifyReply, code: ApiErrorCode): void {
  void reply.status(apiErrorStatus[code]).send(apiErrorResponseSchema.parse({ code }));
}

export function buildApiServer(options: ApiServerOptions): FastifyInstance {
  const app = Fastify({
    logger: {
      ...(options.logStream ? { stream: options.logStream } : {}),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.x-csrf-token',
          'req.body.credential',
          'req.body.userId',
          'req.body.email',
          'req.body.currentCredential',
          'req.body.newPassword',
          'req.body.password',
        ],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 1024 * 1024,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        useDefaults: false,
        allErrors: true,
      },
    },
  });

  app.setErrorHandler(async (error: FastifyError, _request, reply) => {
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      sendError(reply, 'REQUEST_TOO_LARGE');
      return;
    }
    if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      sendError(reply, 'INVALID_JSON');
      return;
    }
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      sendError(reply, 'UNSUPPORTED_MEDIA_TYPE');
      return;
    }
    if (error.validation) {
      sendError(reply, 'INVALID_REQUEST');
      return;
    }
    sendError(reply, 'INTERNAL_ERROR');
  });

  app.addHook('onRequest', async (request, reply) => {
    const contentEncoding = request.headers['content-encoding'];
    if (contentEncoding && contentEncoding.toLowerCase() !== 'identity') {
      sendError(reply, 'UNSUPPORTED_MEDIA_TYPE');
      return;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      if (!options.config.publicOrigin || origin !== options.config.publicOrigin) {
        sendError(reply, 'CSRF_REJECTED');
        return;
      }
      const verified = await options.routes?.verifyCsrf?.(request).catch(() => false) ?? false;
      if (!verified) {
        sendError(reply, 'CSRF_REJECTED');
      }
    }
  });

  app.get('/health/live', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, private');
    return { status: 'live' };
  });

  app.get('/health/ready', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store, private');
    const routeCompositionReady = options.routes?.authentication !== undefined
      && options.routes.commands !== undefined
      && options.routes.verifyCsrf !== undefined;
    const checks = options.readinessChecks ?? [];
    const checksReady = checks.length > 0
      && (await Promise.all(checks.map(async (check) => {
        try {
          return await check.check();
        } catch {
          return false;
        }
      }))).every(Boolean);
    const ready = routeCompositionReady && checksReady && options.config.publicOrigin !== undefined;
    if (!ready) {
      await reply.status(503).send({ status: 'not_ready' });
      return;
    }
    return { status: 'ready' };
  });

  if (options.routes?.authentication) app.register(options.routes.authentication);
  if (options.routes?.commands) app.register(options.routes.commands);
  return app;
}
