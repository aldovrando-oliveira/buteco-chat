import { describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void

// Estado do Electron simulado, refeito a cada teste: o index.ts roda no import.
const state = {
  isPackaged: true,
  lock: true,
  calls: [] as string[],
  listeners: new Map<string, Listener>(),
  windows: [] as { isMinimized(): boolean; restore(): void; focus(): void }[],
  windowsCreated: 0,
  handlers: [] as string[]
}

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return state.isPackaged
    },
    getPath: (name: string) => {
      state.calls.push(`getPath:${name}`)
      return '/dados/Buteco Chat'
    },
    setPath: (name: string, value: string) => state.calls.push(`setPath:${name}:${value}`),
    requestSingleInstanceLock: () => {
      state.calls.push('requestSingleInstanceLock')
      return state.lock
    },
    quit: () => state.calls.push('quit'),
    isReady: () => true,
    on: (name: string, listener: Listener) => state.listeners.set(name, listener),
    whenReady: () => {
      state.calls.push('whenReady')
      return new Promise(() => {})
    }
  },
  BrowserWindow: Object.assign(
    vi.fn(function (this: Record<string, unknown>) {
      state.windowsCreated++
      this.once = vi.fn()
      this.loadFile = vi.fn(async () => {})
      this.loadURL = vi.fn(async () => {})
      this.webContents = { on: vi.fn() }
    }),
    { getAllWindows: () => state.windows, fromWebContents: () => ({}) }
  ),
  ipcMain: { handle: (channel: string) => state.handlers.push(channel) },
  net: { fetch: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  shell: { openExternal: vi.fn() }
}))

async function start(options: { isPackaged: boolean; lock: boolean }) {
  Object.assign(state, { ...options, calls: [], listeners: new Map(), windows: [], windowsCreated: 0, handlers: [] })
  vi.resetModules()
  await import('./index')
}

describe('instância única (D15)', () => {
  it('bloqueio negado: encerra sem janela, sem canais e sem esperar o ready', async () => {
    await start({ isPackaged: true, lock: false })

    expect(state.calls).toEqual(['requestSingleInstanceLock', 'quit'])
    expect(state.listeners.size).toBe(0)
    expect(state.windowsCreated).toBe(0)
    expect(state.handlers).toEqual([])
  })

  it('instância principal: segue a inicialização e escuta second-instance', async () => {
    await start({ isPackaged: true, lock: true })

    expect(state.calls).toEqual(['requestSingleInstanceLock', 'whenReady'])
    expect(state.listeners.has('second-instance')).toBe(true)
  })

  it('second-instance foca a janela existente, restaurando se minimizada', async () => {
    await start({ isPackaged: true, lock: true })
    const existing = { isMinimized: vi.fn(() => true), restore: vi.fn(), focus: vi.fn() }
    state.windows = [existing]

    state.listeners.get('second-instance')!()

    expect(existing.restore).toHaveBeenCalledOnce()
    expect(existing.focus).toHaveBeenCalledOnce()
    expect(state.windowsCreated).toBe(0)
  })

  it('second-instance sem janela abre uma', async () => {
    await start({ isPackaged: true, lock: true })

    state.listeners.get('second-instance')!()

    expect(state.windowsCreated).toBe(1)
  })

  it('pacote: não muda a pasta de dados', async () => {
    await start({ isPackaged: true, lock: true })

    expect(state.calls.some((call) => call.startsWith('setPath'))).toBe(false)
  })

  it('dev: pasta com (dev), definida antes do bloqueio', async () => {
    await start({ isPackaged: false, lock: true })

    expect(state.calls.slice(0, 3)).toEqual([
      'getPath:userData',
      'setPath:userData:/dados/Buteco Chat (dev)',
      'requestSingleInstanceLock'
    ])
  })
})
