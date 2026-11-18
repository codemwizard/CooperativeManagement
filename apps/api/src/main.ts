import { buildApiServer } from './server.js';
import { loadApiRuntimeConfig } from './runtime-config.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The runtime profile is checked before Fastify opens the listener. */
export async function startApi(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadApiRuntimeConfig(environment);
  const app = buildApiServer({ config });
  await app.listen({ host: config.host, port: config.port });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await startApi();
}
