import { BrowserWindow, nativeTheme, type WebPreferences } from 'electron'
import { PAGE_BACKGROUND } from '../../shared/page-background'
import { forwardConsoleMessages } from './console'

export function secureWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webviewTag: false
  }
}

/** Cor da janela antes do primeiro quadro, para não piscar claro no esquema escuro (design D12). */
export function windowBackgroundColor(prefersDark: boolean): string {
  return prefersDark ? PAGE_BACKGROUND.dark : PAGE_BACKGROUND.light
}

/** `icon`: só em dev, para a barra de tarefas no Windows e no Linux; o macOS o ignora (barra-de-status-e-marca, D8). */
export function createMainWindow(preloadPath: string, options: { icon?: string } = {}): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    // 600 deixa espaço para cabeçalho, timeline e composer na largura estreita (barra-de-status-e-marca, D9).
    minHeight: 600,
    title: 'Buteco Chat',
    show: false,
    backgroundColor: windowBackgroundColor(nativeTheme.shouldUseDarkColors),
    webPreferences: secureWebPreferences(preloadPath),
    ...(options.icon === undefined ? {} : { icon: options.icon })
  })
  window.once('ready-to-show', () => window.show())
  // Só o console da janela do app vai para o stdout; o do DevTools não (design D12).
  forwardConsoleMessages(window.webContents)
  return window
}
