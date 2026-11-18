import { buildApiServer } from './server.js';
import { loadApiRuntimeConfig } from './runtime-config.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createAuthComposition } from './authentication-composition.js';
import { createWriteStream, type WriteStream } from 'node:fs';

/** The runtime profile is checked before Fastify opens the listener. */
export async function startApi(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadApiRuntimeConfig(environment);
  if (!config.publicOrigin) throw new Error('PUBLIC_ORIGIN is required to start the authenticated API.');
  const databaseUrl = environment['DATABASE_URL'];
  if (!databaseUrl && config.runtimeProfile === 'test') {
    const app = buildApiServer({ config });
    await app.listen({ host: config.host, port: config.port });
    return;
  }
  if (!databaseUrl) throw new Error('DATABASE_URL is required to start the authenticated API.');
  const encodedKey = environment['AUTH_THROTTLE_HMAC_KEY']
    ?? (config.runtimeProfile === 'test' ? randomBytes(32).toString('base64') : undefined);
  if (!encodedKey || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey)) {
    throw new Error('AUTH_THROTTLE_HMAC_KEY must be base64 encoded key material.');
  }
  const throttleHmacKey = Buffer.from(encodedKey, 'base64');
  if (throttleHmacKey.length < 32 || throttleHmacKey.toString('base64').replace(/=+$/, '') !== encodedKey.replace(/=+$/, '')) {
    throw new Error('AUTH_THROTTLE_HMAC_KEY must decode to at least 32 bytes of valid base64 key material.');
  }
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 20 });
  let authEvidenceLog: WriteStream | undefined;
  const authEvidenceLogPath = environment['WP5_5_API_LOG_PATH'];
  if (authEvidenceLogPath) authEvidenceLog = createWriteStream(authEvidenceLogPath, { flags: 'a' });
  const auth = createAuthComposition({ pool, config, throttleHmacKey });
  const app = buildApiServer({
    config,
    routes: {
      authentication: auth.authentication, verifyCsrf: auth.verifyCsrf,
      authorize: auth.authorize, rotateSession: auth.rotateSession,
    },
    ...(authEvidenceLog ? { logStream: authEvidenceLog } : {}),
    readinessChecks: [{ name: 'postgres-auth', check: auth.healthCheck }],
  });
  const shutdown = (): void => { void app.close().catch(() => undefined); };
  app.addHook('onClose', async () => {
    await pool.end();
    if (authEvidenceLog) await new Promise<void>((resolveClose) => authEvidenceLog!.end(resolveClose));
    process.off('SIGTERM', shutdown);
    process.off('SIGINT', shutdown);
  });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    await app.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await startApi();
}
