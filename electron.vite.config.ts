import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { cspPlugin, DEV_SERVER_PORT } from './tooling/csp'

export default defineConfig({
  main: {},
  preload: {
    build: {
      // Preload com sandbox: um único arquivo CommonJS, com tudo embutido (design D4).
      // No Vite 8 a opção é `rolldownOptions` (não `rollupOptions`).
      externalizeDeps: false,
      rolldownOptions: {
        output: { format: 'cjs', codeSplitting: false }
      }
    }
  },
  renderer: {
    plugins: [react(), cspPlugin()],
    server: { port: DEV_SERVER_PORT, strictPort: true },
    build: {
      // Nenhum asset vira `data:` (design D11).
      assetsInlineLimit: 0
    }
  }
})
