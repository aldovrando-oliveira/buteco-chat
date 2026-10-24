import { join } from 'node:path'
import { app, BrowserWindow, session, shell } from 'electron'
import { rendererLocation, setTrustedRenderer } from './ipc/handle'
import { devServerOrigin, resolveRuntime } from './runtime'
import { installNavigationGuards } from './security/navigation'
import { denyAllPermissions } from './security/permissions'
import { createMainWindow } from './security/window'

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
  openMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
