import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reportsDirectory: './coverage',
      reporter: ['json-summary', 'text', 'lcov'],
    },
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['verbose'],
  },
});
