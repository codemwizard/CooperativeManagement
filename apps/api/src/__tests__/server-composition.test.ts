import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { FastifyPluginAsync } from 'fastify';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { changePasswordRequestSchema, loginRequestSchema } from '@symphony/contracts';
import { buildApiServer } from '../server.js';
import { loadApiRuntimeConfig, RuntimeConfigurationError } from '../runtime-config.js';

const testRuntime = {
  RUNTIME_PROFILE: 'test',
  APP_ENV: 'test',
  DATA_MODE: 'test',
} as NodeJS.ProcessEnv;

describe('shared authentication contracts', () => {
  it('rejects unknown login fields and accepts the shared request shape', () => {
    expect(loginRequestSchema.safeParse({ userId: 'u1', credential: 'secret', deviceId: 'd1' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ userId: 'u1', credential: 'secret', deviceId: 'd1', role: 'admin' }).success).toBe(false);
  });

  it('measures password length in Unicode code points without trimming', () => {
    expect(changePasswordRequestSchema.safeParse({ currentCredential: 'old', newPassword: '😀'.repeat(11) }).success).toBe(false);
    expect(changePasswordRequestSchema.safeParse({ currentCredential: 'old', newPassword: '😀'.repeat(12) }).success).toBe(true);
    expect(changePasswordRequestSchema.safeParse({ currentCredential: 'old', newPassword: ` ${'a'.repeat(10)} ` }).success).toBe(true);
    expect(changePasswordRequestSchema.safeParse({ currentCredential: 'old', newPassword: '😀'.repeat(1025) }).success).toBe(false);
    expect(changePasswordRequestSchema.safeParse({ currentCredential: 'old', newPassword: '😀'.repeat(12), userId: 'forged' }).success).toBe(false);
  });
});

describe('API runtime profile and listener composition', () => {
  let close: (() => Promise<void>) | undefined;
  let child: ChildProcess | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
    if (child && child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
    child = undefined;
  });

  it('starts the shipped entrypoint only after profile validation and keeps the real process unready', async () => {
    const portProbe = createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    const port = (portProbe.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));

    child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test', PUBLIC_ORIGIN: 'http://127.0.0.1', PORT: String(port), HOST: '127.0.0.1' },
      stdio: 'ignore',
    });

    const origin = `http://127.0.0.1:${port}`;
    let live: Response | undefined;
    for (let attempt = 0; attempt < 150; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`API entrypoint exited early with code ${child.exitCode}`);
      try {
        live = await fetch(`${origin}/health/live`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    expect(live?.status).toBe(200);
    expect(await live?.json()).toEqual({ status: 'live' });
    const ready = await fetch(`${origin}/health/ready`);
    expect(ready.status).toBe(503);
    expect(await ready.json()).toEqual({ status: 'not_ready' });
  });

  it('fails closed when the profile is missing or contradicts APP_ENV/DATA_MODE', () => {
    expect(() => loadApiRuntimeConfig({})).toThrow(RuntimeConfigurationError);
    expect(() => loadApiRuntimeConfig({ ...testRuntime, DATA_MODE: 'real' })).toThrow(RuntimeConfigurationError);
  });

  it('serves health from a real listener and stays unready until required routes and checks exist', async () => {
    const config = loadApiRuntimeConfig(testRuntime);
    const app = buildApiServer({ config });
    await app.listen({ host: '127.0.0.1', port: 0 });
    close = () => app.close();
    const address = app.server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    const live = await fetch(`${origin}/health/live`);
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: 'live' });

    const ready = await fetch(`${origin}/health/ready`);
    expect(ready.status).toBe(503);
    expect(await ready.json()).toEqual({ status: 'not_ready' });
  });

  it('rejects unsupported encodings and unsafe requests without the configured Origin and CSRF token', async () => {
    const config = loadApiRuntimeConfig({ ...testRuntime, PUBLIC_ORIGIN: 'http://127.0.0.1' });
    const app = buildApiServer({
      config,
      routes: { verifyCsrf: async () => false },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    close = () => app.close();
    const address = app.server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    const encoded = await fetch(`${origin}/health/live`, { headers: { 'content-encoding': 'gzip' } });
    expect(encoded.status).toBe(415);
    expect(await encoded.json()).toEqual({ code: 'UNSUPPORTED_MEDIA_TYPE' });

    const missingOrigin = await fetch(`${origin}/unknown`, { method: 'POST' });
    expect(missingOrigin.status).toBe(403);
    expect(await missingOrigin.json()).toEqual({ code: 'CSRF_REJECTED' });

    const badCsrf = await fetch(`${origin}/unknown`, {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1', 'x-csrf-token': 'invalid' },
    });
    expect(badCsrf.status).toBe(403);
    expect(await badCsrf.json()).toEqual({ code: 'CSRF_REJECTED' });
  });

  it('maps malformed requests and unexpected errors to stable non-disclosing responses', async () => {
    const config = loadApiRuntimeConfig({ ...testRuntime, PUBLIC_ORIGIN: 'http://127.0.0.1' });
    const authentication: FastifyPluginAsync = async () => {};
    const commands: FastifyPluginAsync = async (app) => {
      app.post('/strict', {
        schema: {
          body: {
            type: 'object',
            additionalProperties: false,
            required: ['value'],
            properties: { value: { type: 'string' } },
          },
        },
      }, async (request) => request.body);
      app.get('/failure', async () => { throw new Error('sensitive internal detail'); });
    };
    const app = buildApiServer({
      config,
      routes: { authentication, commands, verifyCsrf: async () => true },
      readinessChecks: [{ name: 'test dependency', check: async () => true }],
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    close = () => app.close();
    const address = app.server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    const ready = await fetch(`${origin}/health/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ready' });

    const invalid = await fetch(`${origin}/strict`, {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1', 'content-type': 'application/json', 'x-csrf-token': 'valid' },
      body: JSON.stringify({ value: 5, extra: true }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ code: 'INVALID_REQUEST' });

    const malformed = await fetch(`${origin}/strict`, {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1', 'content-type': 'application/json', 'x-csrf-token': 'valid' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ code: 'INVALID_JSON' });

    const oversized = await fetch(`${origin}/strict`, {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1', 'content-type': 'application/json', 'x-csrf-token': 'valid' },
      body: JSON.stringify({ value: 'x'.repeat(1024 * 1024) }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ code: 'REQUEST_TOO_LARGE' });

    const failed = await fetch(`${origin}/failure`);
    expect(failed.status).toBe(500);
    const failedBody = await failed.text();
    expect(JSON.parse(failedBody)).toEqual({ code: 'INTERNAL_ERROR' });
    expect(failedBody).not.toContain('sensitive internal detail');
  });
});

describe('API authentication log redaction', () => {
  it('does not emit unique credential and password canaries in application logs', async () => {
    const credentialCanary = `TEMP_CREDENTIAL_CANARY_${randomUUID()}`;
    const currentPasswordCanary = `CURRENT_PASSWORD_CANARY_${randomUUID()}`;
    const permanentPasswordCanary = `PERMANENT_PASSWORD_CANARY_${randomUUID()}`;
    const userCanary = `USER_IDENTIFIER_CANARY_${randomUUID()}`;
    const lines: string[] = [];
    const config = loadApiRuntimeConfig({ ...testRuntime, PUBLIC_ORIGIN: 'http://127.0.0.1' });
    const commands: FastifyPluginAsync = async (app) => {
      app.post('/log-canary', async (request) => {
        app.log.info({ req: { body: request.body } }, 'authentication log-redaction fixture');
        return { ok: true };
      });
    };
    const app = buildApiServer({
      config,
      logStream: { write: (line) => lines.push(line) },
      routes: { commands, verifyCsrf: async () => true },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/log-canary',
      headers: { origin: 'http://127.0.0.1', 'x-csrf-token': 'valid' },
      payload: {
        credential: credentialCanary,
        currentCredential: currentPasswordCanary,
        newPassword: permanentPasswordCanary,
        userId: userCanary,
      },
    });
    await app.close();

    const applicationLog = lines.join('');
    expect(response.statusCode).toBe(200);
    for (const canary of [credentialCanary, currentPasswordCanary, permanentPasswordCanary, userCanary]) {
      expect(applicationLog).not.toContain(canary);
    }
    expect(applicationLog).toContain('authentication log-redaction fixture');
  });
});
