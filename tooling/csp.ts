import type { Plugin } from 'vite'

/** Porta fixa do servidor de dev do renderer (`strictPort`), para a CSP de dev poder citá-la. */
export const DEV_SERVER_PORT = 5173

/** CSP do build de produção (design D6). Não afrouxar: se algo falhar sob file://, migrar para protocol.handle (D5). */
export const PRODUCTION_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'"
].join('; ')

/** CSP de dev: libera só o preâmbulo inline do React Refresh e a origem exata do servidor Vite (HTTP e WebSocket do HMR). */
export function developmentCsp(port: number = DEV_SERVER_PORT): string {
  return [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self'",
    `connect-src http://localhost:${port} ws://localhost:${port}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "object-src 'none'"
  ].join('; ')
}

/** Injeta a meta CSP no index.html: a de dev no `serve`, a de produção no `build`. */
export function cspPlugin(): Plugin {
  let policy = PRODUCTION_CSP
  return {
    name: 'buteco-csp',
    configResolved(config) {
      policy = config.command === 'serve' ? developmentCsp(config.server.port) : PRODUCTION_CSP
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}
