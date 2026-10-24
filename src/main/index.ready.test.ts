import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
const netFetch = vi.fn(async () => new Response(null, { status: 401 }))

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
  net: { fetch: netFetch },
  nativeTheme: { shouldUseDarkColors: false },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
  shell: { openExternal: vi.fn() }
}))

await import('./index')
await Promise.resolve()

describe('main depois do ready', () => {
  it('registra os canais auth:* e o login sai pelo net.fetch', async () => {
    expect([...handlers.keys()].sort()).toEqual(['auth:login', 'auth:logout', 'auth:status'])

    // O mesmo caminho que o index.ts calcula a partir do próprio diretório.
    const indexHtml = join(__dirname, '../renderer/index.html')
    const frame = { url: pathToFileURL(indexHtml).href, parent: null }
    const result = await handlers.get('auth:login')!({ sender: {}, senderFrame: frame }, 'http://localhost:5017', 'ana', 'x')

    expect(netFetch).toHaveBeenCalledWith('http://localhost:5017/auth/login', expect.objectContaining({ method: 'POST' }))
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-credentials' } })
  })
})
