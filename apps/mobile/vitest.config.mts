import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic in src/lib (no React Native imports).
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
