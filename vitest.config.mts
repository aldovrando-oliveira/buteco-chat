import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/preload/**/*.test.ts', 'src/shared/**/*.test.ts', 'tooling/**/*.test.ts']
        }
      },
      {
        plugins: [react()],
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts']
        }
      },
      {
        // Verificações sobre os artefatos de `npm run build` (rodam com `npm run test:build`).
        test: {
          name: 'build',
          environment: 'node',
          include: ['tests/build/**/*.test.ts']
        }
      }
    ]
  }
})
