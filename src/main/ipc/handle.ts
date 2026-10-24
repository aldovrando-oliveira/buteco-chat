import { pathToFileURL } from 'node:url'
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { Runtime } from '../runtime'

/** Onde o renderer legítimo vive: o index.html empacotado ou a origem do servidor de dev. */
export type RendererLocation = { kind: 'file'; pathname: string } | { kind: 'dev'; origin: string }

export function rendererLocation(runtime: Runtime, indexHtmlPath: string): RendererLocation {
  if (runtime.kind === 'dev-server') return { kind: 'dev', origin: runtime.origin }
  // pathToFileURL, nunca concatenação: o caminho do app empacotado tem espaço ("Buteco Chat.app").
  return { kind: 'file', pathname: pathToFileURL(indexHtmlPath).pathname }
}

/** Compara a URL do frame com a do renderer, ignorando hash e query. */
export function isRendererUrl(url: string, location: RendererLocation): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (location.kind === 'dev') return parsed.origin === location.origin
  return parsed.protocol === 'file:' && parsed.pathname === location.pathname
}

export interface SenderFrame {
  url: string
  parent: unknown
}

export function isTrustedSender(
  frame: SenderFrame | null,
  isAppWindow: boolean,
  location: RendererLocation
): boolean {
  if (frame === null || frame.parent !== null || !isAppWindow) return false
  return isRendererUrl(frame.url, location)
}

let trustedRenderer: RendererLocation | null = null

export function setTrustedRenderer(location: RendererLocation): void {
  trustedRenderer = location
}

/**
 * Único jeito de registrar um handler IPC (design D9): valida o remetente, depois os argumentos com `parseArgs`,
 * e só então executa `fn`. Se `parseArgs` lançar erro, a chamada é rejeitada sem executar `fn`.
 */
export function handle<Args extends unknown[], Result>(
  channel: string,
  parseArgs: (args: unknown[]) => Args,
  fn: (...args: Args) => Result | Promise<Result>
): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    const isAppWindow = BrowserWindow.fromWebContents(event.sender) !== null
    if (trustedRenderer === null || !isTrustedSender(event.senderFrame, isAppWindow, trustedRenderer)) {
      throw new Error(`Remetente IPC não autorizado em ${channel}.`)
    }
    let parsed: Args
    try {
      parsed = parseArgs(args)
    } catch (cause) {
      throw new Error(`Argumentos IPC inválidos em ${channel}.`, { cause })
    }
    return fn(...parsed)
  })
}
