import { describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void

// Estado do Electron simulado, refeito a cada teste: o index.ts roda no import.
const state = {
  isPackaged: true,
  lock: true,
  ready: false,
  calls: [] as string[],
  listeners: new Map<string, Listener>(),
  windows: [] as { isMinimized(): boolean; restore(): void; focus(): void }[],
  windowsCreated: 0,
  windowOptions: [] as Record<string, unknown>[],
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
    getAppPath: () => '/projeto',
    dock: { setIcon: (path: string) => state.calls.push(`dock.setIcon:${path}`) },
    requestSingleInstanceLock: () => {
      state.calls.push('requestSingleInstanceLock')
      return state.lock
    },
    quit: () => state.calls.push('quit'),
    isReady: () => true,
    on: (name: string, listener: Listener) => state.listeners.set(name, listener),
    whenReady: () => {
      state.calls.push('whenReady')
      return state.ready ? Promise.resolve() : new Promise(() => {})
    }
  },
  BrowserWindow: Object.assign(
    vi.fn(function (this: Record<string, unknown>, options: Record<string, unknown>) {
      state.windowsCreated++
      state.windowOptions.push(options)
      this.once = vi.fn()
      this.loadFile = vi.fn(async () => {})
      this.loadURL = vi.fn(async () => {})
      this.webContents = { on: vi.fn() }
    }),
    { getAllWindows: () => state.windows, fromWebContents: () => ({}) }
  ),
  ipcMain: { handle: (channel: string) => state.handlers.push(channel) },
  clipboard: { writeText: vi.fn() },
  net: { fetch: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  shell: { openExternal: vi.fn() }
}))

async function start(options: { isPackaged: boolean; lock: boolean; ready?: boolean }) {
  Object.assign(state, {
    ready: false,
    ...options,
    calls: [],
    listeners: new Map(),
    windows: [],
    windowsCreated: 0,
    windowOptions: [],
    handlers: []
  })
  vi.resetModules()
  await import('./index')
  await Promise.resolve()
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

describe('ícone do app (barra-de-status-e-marca, D8)', () => {
  it('dev: a janela recebe o PNG de quadro inteiro e o Dock, o do macOS', async () => {
    await start({ isPackaged: false, lock: true, ready: true })

    expect(state.calls).toContain('dock.setIcon:/projeto/build/icon-mac.png')
    expect(state.windowOptions).toHaveLength(1)
    expect(state.windowOptions[0]).toMatchObject({ icon: '/projeto/build/icon.png' })
  })

  it('pacote: sem ícone na janela e sem trocar o do Dock', async () => {
    await start({ isPackaged: true, lock: true, ready: true })

    expect(state.calls.some((call) => call.startsWith('dock.setIcon'))).toBe(false)
    expect(state.windowOptions).toHaveLength(1)
    expect(state.windowOptions[0]).not.toHaveProperty('icon')
  })
})
