import { describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void
const appListeners = new Map<string, Listener>()

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    on: (name: string, listener: Listener) => appListeners.set(name, listener),
    whenReady: () => new Promise(() => {}) // a janela não é criada neste teste
  },
  BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
  ipcMain: { handle: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  session: { defaultSession: {} },
  shell: { openExternal: vi.fn() }
}))

await import('./index')

describe('web-contents-created', () => {
  it('liga as guardas em qualquer webContents, mas não encaminha o console dele (ex.: DevTools)', () => {
    const contents = { on: vi.fn(), setWindowOpenHandler: vi.fn() }

    appListeners.get('web-contents-created')?.({}, contents)

    const events = contents.on.mock.calls.map(([name]) => name)
    expect(events).toEqual(expect.arrayContaining(['will-navigate', 'will-attach-webview']))
    expect(contents.setWindowOpenHandler).toHaveBeenCalledOnce()
    expect(events).not.toContain('console-message')
  })
})
