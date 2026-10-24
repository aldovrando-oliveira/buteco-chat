/**
 * Instância única e pasta de dados do dev (design D15 da login-operador). Com outra instância segurando a mesma pasta
 * de dados, o `localStorage` da segunda fica só em memória e se perde ao fechar, sem erro.
 */

/** Pasta de dados fora do pacote: o dev nunca disputa nem mistura dados com o app empacotado. */
export function devUserDataPath(defaultPath: string): string {
  return `${defaultPath} (dev)`
}

export interface FocusableWindow {
  isMinimized(): boolean
  restore(): void
  focus(): void
}

/** Ao abrir uma segunda instância: traz a janela existente para a frente, ou abre uma (macOS sem janela). */
export function focusOrOpen(windows: readonly FocusableWindow[], open: () => void): void {
  const [window] = windows
  if (window === undefined) {
    open()
    return
  }
  if (window.isMinimized()) window.restore()
  window.focus()
}
