import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 30000, // DB tests may take longer
    // Integration suites share one test database and temporarily disable
    // append-only triggers for fixture cleanup, so file-level concurrency is unsafe.
    fileParallelism: false,
  },
});

