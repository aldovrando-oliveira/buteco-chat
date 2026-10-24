import type { WebContents } from 'electron'

export type ExternalUrlDecision = 'open-external' | 'discard'

/** Só URLs http(s) válidas podem sair do app, e sempre pelo navegador padrão. */
export function classifyExternalUrl(url: string): ExternalUrlDecision {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'discard'
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? 'open-external' : 'discard'
}

/**
 * Exceção só em dev (design D7): navegar para a origem exata do dev server segue, para o Vite poder recarregar a
 * página. No app empacotado nunca vale, mesmo que uma origem seja informada.
 */
export function isDevServerNavigation(url: string, isPackaged: boolean, devOrigin: string | null): boolean {
  if (isPackaged || devOrigin === null) return false
  try {
    return new URL(url).origin === devOrigin
  } catch {
    return false
  }
}

export type OpenExternal = (url: string) => unknown

export interface NavigationPolicy {
  isPackaged: boolean
  devOrigin: string | null
  openExternal: OpenExternal
}

export function handleWillNavigate(event: { preventDefault(): void; url: string }, policy: NavigationPolicy): void {
  if (isDevServerNavigation(event.url, policy.isPackaged, policy.devOrigin)) return
  event.preventDefault()
  if (classifyExternalUrl(event.url) === 'open-external') policy.openExternal(event.url)
}

export function handleWindowOpen(details: { url: string }, openExternal: OpenExternal): { action: 'deny' } {
  if (classifyExternalUrl(details.url) === 'open-external') openExternal(details.url)
  return { action: 'deny' }
}

/** Aplicado em `web-contents-created`, para valer em qualquer webContents do app. */
export function installNavigationGuards(contents: WebContents, policy: NavigationPolicy): void {
  contents.on('will-navigate', (event) => handleWillNavigate(event, policy))
  contents.setWindowOpenHandler((details) => handleWindowOpen(details, policy.openExternal))
  contents.on('will-attach-webview', (event) => event.preventDefault())
}
