import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '~': resolve(__dirname, './playground'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'playground/**',
        'tests/**',
        '**/*.config.*',
        '**/*.d.ts',
        'build.config.ts',
        'vitest.config.ts',
        'eslint.config.mjs',
        'commitlint.config.mjs',
        'playground.config.ts',
      ],
      include: ['src/**/*'],
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
  },
});
