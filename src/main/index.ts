import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, net, session, shell } from 'electron'
import { registerAuthHandlers } from './auth/ipc'
import { createAuthService } from './auth/service'
import { createChatClient } from './chat/client'
import { registerChatHandlers } from './chat/ipc'
import { registerClipboardHandlers } from './clipboard/ipc'
import { devUserDataPath, focusOrOpen } from './instance'
import { rendererLocation, setTrustedRenderer } from './ipc/handle'
import { devServerOrigin, resolveRuntime } from './runtime'
import { installNavigationGuards } from './security/navigation'
import { denyAllPermissions } from './security/permissions'
import { createMainWindow } from './security/window'

// Antes de tudo (design D15 da login-operador): a pasta de dados define o bloqueio de instância e onde o
// localStorage persiste.
if (!app.isPackaged) app.setPath('userData', devUserDataPath(app.getPath('userData')))

// Sem o bloqueio, outra instância já está aberta: encerra sem janela nem canais IPC.
if (app.requestSingleInstanceLock()) startPrimaryInstance()
else app.quit()

function startPrimaryInstance(): void {
  const runtime = resolveRuntime(app.isPackaged, process.env['ELECTRON_RENDERER_URL'])
  const indexHtmlPath = join(__dirname, '../renderer/index.html')
  const preloadPath = join(__dirname, '../preload/index.js')

  setTrustedRenderer(rendererLocation(runtime, indexHtmlPath))

  // Guardas em todo webContents (inclusive o do DevTools); o console vai ao stdout só da janela do app (createMainWindow).
  app.on('web-contents-created', (_event, contents) => {
    installNavigationGuards(contents, {
      isPackaged: app.isPackaged,
      devOrigin: devServerOrigin(runtime),
      openExternal: (url) => shell.openExternal(url)
    })
  })

  function openMainWindow(): void {
    const window = createMainWindow(preloadPath)
    if (runtime.kind === 'dev-server') void window.loadURL(runtime.url)
    else void window.loadFile(indexHtmlPath)
  }

  void app.whenReady().then(() => {
    denyAllPermissions(session.defaultSession)
    // net.fetch só funciona depois do ready (design D1 da login-operador). Pilha do Chromium: proxy e certificados
    // do sistema.
    const auth = createAuthService({
      fetch: (url, init) => net.fetch(url, init),
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle)
    })
    registerAuthHandlers(auth)
    registerChatHandlers(
      createChatClient({
        fetch: (url, init) => net.fetch(url, init),
        auth,
        setTimeout: (callback, ms) => setTimeout(callback, ms),
        clearTimeout: (handle) => clearTimeout(handle),
        randomUUID: () => randomUUID()
      })
    )
    registerClipboardHandlers(clipboard)
    openMainWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
    })
  })

  app.on('second-instance', () => {
    if (app.isReady()) focusOrOpen(BrowserWindow.getAllWindows(), openMainWindow)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
