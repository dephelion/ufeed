import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['src/adapters/**', 'happy-dom'],
      ['src/content/**', 'happy-dom'],
    ],
  },
});
