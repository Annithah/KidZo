import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each file boots an in-memory Postgres (PGlite), which is slow to start on some machines.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
