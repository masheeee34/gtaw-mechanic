import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'client',
          include: ['client/tests/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'repo',
          include: ['tests/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          include: ['web/src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['web/src/test/setup.ts'],
        },
      },
    ],
  },
});
