import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Deliberately separate from vite.config.ts so the test run never depends on
// the Tailwind/lightningcss pipeline (which needs a platform-specific native
// binary and isn't exercised by any test).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
      ],
    },
  },
})
