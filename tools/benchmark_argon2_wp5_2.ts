import * as argon2 from 'argon2';
import { cpus, availableParallelism, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { ARGON2ID_PARAMETERS } from '../packages/domain/src/identity/credential-lifecycle.js';

const password = 'phase1 benchmark passphrase 2026';
const sustainedConcurrency = 8;
const sustainedDurationMs = 60_000;
const hash = await argon2.hash(password, { type: argon2.argon2id, ...ARGON2ID_PARAMETERS });
const serialSamples: number[] = [];

for (let i = 0; i < 5; i += 1) {
  const started = performance.now();
  const valid = await argon2.verify(hash, password);
  const elapsed = performance.now() - started;
  if (!valid) throw new Error('Argon2id benchmark verification failed');
  serialSamples.push(elapsed);
}

const concurrent: Record<string, { wallMs: number; perVerificationMs: number[] }> = {};
for (const concurrency of [2, 4, 8]) {
  const started = performance.now();
  const durations: number[] = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    const verifyStarted = performance.now();
    const valid = await argon2.verify(hash, password);
    durations.push(performance.now() - verifyStarted);
    if (!valid) throw new Error('Argon2id benchmark verification failed');
  }));
  concurrent[String(concurrency)] = {
    wallMs: performance.now() - started,
    perVerificationMs: durations.sort((a, b) => a - b),
  };
}

const sustainedLatencies: number[] = [];
const sustainedStarted = performance.now();
const sustainedDeadline = sustainedStarted + sustainedDurationMs;
const memoryBefore = process.memoryUsage();
await Promise.all(Array.from({ length: sustainedConcurrency }, async () => {
  while (performance.now() < sustainedDeadline) {
    const verifyStarted = performance.now();
    const valid = await argon2.verify(hash, password);
    sustainedLatencies.push(performance.now() - verifyStarted);
    if (!valid) throw new Error('Argon2id sustained benchmark verification failed');
  }
}));
const sustainedWallMs = performance.now() - sustainedStarted;
const memoryAfter = process.memoryUsage();
const sortedSustainedLatencies = [...sustainedLatencies].sort((a, b) => a - b);
const percentile = (sorted: number[], p: number): number => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
const sustained = {
  concurrency: sustainedConcurrency,
  requestedDurationMs: sustainedDurationMs,
  wallMs: sustainedWallMs,
  verificationCount: sortedSustainedLatencies.length,
  throughputPerSecond: sortedSustainedLatencies.length / (sustainedWallMs / 1000),
  latencyMs: {
    p50: percentile(sortedSustainedLatencies, 0.50),
    p95: percentile(sortedSustainedLatencies, 0.95),
    p99: percentile(sortedSustainedLatencies, 0.99),
    max: sortedSustainedLatencies.at(-1) ?? 0,
  },
  verificationUnderOneSecond: sortedSustainedLatencies.every((latency) => latency < 1000),
  rssBytesBefore: memoryBefore.rss,
  rssBytesAfter: memoryAfter.rss,
};

const report = {
  parameters: { algorithm: 'Argon2id', ...ARGON2ID_PARAMETERS },
  environment: {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    osRelease: (await import('node:os')).release(),
    cpuModel: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    availableParallelism: availableParallelism(),
    totalMemoryBytes: totalmem(),
  },
  sampleCount: serialSamples.length,
  serialVerificationMs: serialSamples,
  serialMedianMs: [...serialSamples].sort((a, b) => a - b)[Math.floor(serialSamples.length / 2)],
  serialMaxMs: Math.max(...serialSamples),
  concurrent,
  sustained,
  qualification: 'Owner-approved interim profile only: eight concurrent verification workers sustained for 60 seconds; report p50/p95/p99 and keep every verification below one second. This does not claim production expected-load qualification.',
};
console.log(JSON.stringify(report, null, 2));
if (!sustained.verificationUnderOneSecond) {
  throw new Error('At least one sustained Argon2id verification took one second or longer');
}
