import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
const netFetch = vi.fn(async () => new Response(null, { status: 401 }))
const clipboardWriteText = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    requestSingleInstanceLock: () => true,
    isReady: () => true,
    on: vi.fn(),
    whenReady: () => Promise.resolve()
  },
  BrowserWindow: Object.assign(
    vi.fn(function (this: Record<string, unknown>) {
      this.once = vi.fn()
      this.loadFile = vi.fn(async () => {})
      this.webContents = { on: vi.fn() }
    }),
    { getAllWindows: () => [], fromWebContents: () => ({}) }
  ),
  ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
  clipboard: { writeText: clipboardWriteText },
  net: { fetch: netFetch },
  nativeTheme: { shouldUseDarkColors: false },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  shell: { openExternal: vi.fn() }
}))

await import('./index')
await Promise.resolve()

// O mesmo caminho que o index.ts calcula a partir do próprio diretório.
const frame = { url: pathToFileURL(join(__dirname, '../renderer/index.html')).href, parent: null }

function invoke(channel: string, ...args: unknown[]): unknown {
  return handlers.get(channel)!({ sender: {}, senderFrame: frame }, ...args)
}

describe('main depois do ready', () => {
  it('registra os canais auth:*, agents:*, chat:* e clipboard:*', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'agents:list',
      'auth:login',
      'auth:logout',
      'auth:status',
      'chat:getTask',
      'chat:send',
      'clipboard:writeText'
    ])
  })

  it('o login sai pelo net.fetch', async () => {
    const result = await invoke('auth:login', 'http://localhost:5017', 'ana', 'x')

    expect(netFetch).toHaveBeenCalledWith('http://localhost:5017/auth/login', expect.objectContaining({ method: 'POST' }))
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-credentials' } })
  })

  it('o cliente da conversa usa a sessão do mesmo serviço de autenticação', async () => {
    netFetch.mockClear()

    // Deslogado: unauthorized sem rede, porque o cliente lê a sessão do AuthService registrado.
    expect(await invoke('agents:list')).toEqual({ ok: false, error: { kind: 'unauthorized' } })
    expect(netFetch).not.toHaveBeenCalled()
  })

  it('clipboard:writeText chega ao clipboard do Electron', async () => {
    await invoke('clipboard:writeText', 'ctx-1')

    expect(clipboardWriteText).toHaveBeenCalledWith('ctx-1')
  })
})
