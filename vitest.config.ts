import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    // Model tests load real weights and take seconds; run them with test:model.
    exclude: ['**/node_modules/**', 'src/**/*.model.test.ts'],
  },
});
