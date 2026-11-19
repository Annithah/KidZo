import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/seed.ts', 'src/create-admin.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  noExternal: ['@kidzo/shared'],
});
