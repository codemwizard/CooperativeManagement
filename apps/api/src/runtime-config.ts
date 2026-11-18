import { z } from 'zod';

const runtimeProfiles = {
  test: { appEnv: 'test', dataMode: 'test' },
  demo: { appEnv: 'development', dataMode: 'test' },
  'real-data-staging': { appEnv: 'staging', dataMode: 'real' },
  production: { appEnv: 'production', dataMode: 'real' },
} as const;

const runtimeEnvironmentSchema = z.object({
  RUNTIME_PROFILE: z.enum(['test', 'demo', 'real-data-staging', 'production']),
  APP_ENV: z.enum(['test', 'development', 'staging', 'production']),
  DATA_MODE: z.enum(['test', 'real']),
  PUBLIC_ORIGIN: z.string().url().refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.origin === value && parsed.username === '' && parsed.password === '';
    } catch {
      return false;
    }
  }).optional(),
  PORT: z.string().regex(/^\d+$/).optional(),
  HOST: z.string().min(1).optional(),
}).passthrough();

export interface ApiRuntimeConfig {
  readonly runtimeProfile: keyof typeof runtimeProfiles;
  readonly appEnv: string;
  readonly dataMode: string;
  readonly publicOrigin?: string;
  readonly host: string;
  readonly port: number;
}

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

/** Validates the profile tuple before the API opens a listener or database connection. */
export function loadApiRuntimeConfig(environment: NodeJS.ProcessEnv): ApiRuntimeConfig {
  const parsed = runtimeEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path[0]).filter((part): part is string => typeof part === 'string'))];
    throw new RuntimeConfigurationError(`Invalid API runtime configuration: ${fields.join(', ') || 'environment'}`);
  }

  const selected = runtimeProfiles[parsed.data.RUNTIME_PROFILE];
  if (parsed.data.APP_ENV !== selected.appEnv || parsed.data.DATA_MODE !== selected.dataMode) {
    throw new RuntimeConfigurationError('RUNTIME_PROFILE, APP_ENV and DATA_MODE do not match an approved profile');
  }

  const port = parsed.data.PORT === undefined ? 3000 : Number(parsed.data.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RuntimeConfigurationError('PORT must be an integer from 1 to 65535');
  }

  return {
    runtimeProfile: parsed.data.RUNTIME_PROFILE,
    appEnv: parsed.data.APP_ENV,
    dataMode: parsed.data.DATA_MODE,
    ...(parsed.data.PUBLIC_ORIGIN ? { publicOrigin: parsed.data.PUBLIC_ORIGIN } : {}),
    host: parsed.data.HOST ?? '127.0.0.1',
    port,
  };
}
