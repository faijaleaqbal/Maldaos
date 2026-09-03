import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@campuspulse/ai-gateway': resolve(__dirname, '../ai-gateway/src/index.ts'),
      '@campuspulse/ai-gateway/': resolve(__dirname, '../ai-gateway/src/') + '/',
    },
  },
  css: false,
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: ['default'],
  },
});
