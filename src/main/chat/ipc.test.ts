import { pathToFileURL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Listener>()

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, listener: Listener) => handlers.set(channel, listener) },
  BrowserWindow: { fromWebContents: () => ({}) }
}))

const { rendererLocation, setTrustedRenderer } = await import('../ipc/handle')
const { MAX_MESSAGE_LENGTH, parseGetTaskArgs, parseSendArgs, registerChatHandlers } = await import('./ipc')
const { MAX_CLIPBOARD_LENGTH, parseWriteTextArgs, registerClipboardHandlers } = await import('../clipboard/ipc')

const AGENT = '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f'
const INDEX_HTML = '/Applications/Buteco Chat.app/Contents/Resources/app.asar/out/renderer/index.html'
const frame = { url: pathToFileURL(INDEX_HTML).href, parent: null }

function invoke(channel: string, ...args: unknown[]): unknown {
  const listener = handlers.get(channel)
  if (!listener) throw new Error(`canal ${channel} não registrado`)
  return listener({ sender: {}, senderFrame: frame }, ...args)
}

function thrown(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    return error as Error
  }
  throw new Error('esperava erro')
}

describe('parseSendArgs', () => {
  it('aceita os limites: 16 000 caracteres e contextId com 128', () => {
    const args = [AGENT, 'x'.repeat(MAX_MESSAGE_LENGTH), 'c'.repeat(128)]

    expect(parseSendArgs(args)).toEqual(args)
  })

  it('aceita contextId null e texto como foi digitado', () => {
    expect(parseSendArgs([AGENT, '  oi\n', null])).toEqual([AGENT, '  oi\n', null])
  })

  it.each([
    ['dois argumentos', [AGENT, 'oi']],
    ['quatro argumentos', [AGENT, 'oi', null, 'x']],
    ['texto número', [AGENT, 1, null]],
    ['contextId undefined', [AGENT, 'oi', undefined]],
    ['agentId ../auth/login', ['../auth/login', 'oi', null]],
    ['agentId x/y', ['x/y', 'oi', null]],
    ['agentId x?y', ['x?y', 'oi', null]],
    ['agentId GUID com / no fim', [`${AGENT}/`, 'oi', null]],
    ['texto com 16 001', [AGENT, 'x'.repeat(MAX_MESSAGE_LENGTH + 1), null]],
    ['texto vazio', [AGENT, '', null]],
    ['texto só de espaços', [AGENT, '  \n\t ', null]],
    ['contextId com 129', [AGENT, 'oi', 'c'.repeat(129)]],
    ['contextId com /', [AGENT, 'oi', 'a/b']]
  ])('recusa %s', (_label, args) => {
    expect(() => parseSendArgs(args)).toThrow()
  })
})

describe('parseGetTaskArgs', () => {
  it('aceita agentId GUID e taskId válido', () => {
    expect(parseGetTaskArgs([AGENT, 't-1'])).toEqual([AGENT, 't-1'])
  })

  it.each([
    ['um argumento', [AGENT]],
    ['agentId ../auth/login', ['../auth/login', 't-1']],
    ['taskId com /', [AGENT, 'a/b']],
    ['taskId com 129', [AGENT, 't'.repeat(129)]],
    ['taskId número', [AGENT, 1]]
  ])('recusa %s', (_label, args) => {
    expect(() => parseGetTaskArgs(args)).toThrow()
  })
})

describe('parseWriteTextArgs', () => {
  it('aceita 1024 caracteres e recusa 1025', () => {
    expect(parseWriteTextArgs(['x'.repeat(MAX_CLIPBOARD_LENGTH)])).toEqual(['x'.repeat(MAX_CLIPBOARD_LENGTH)])
    expect(() => parseWriteTextArgs(['x'.repeat(MAX_CLIPBOARD_LENGTH + 1)])).toThrow()
  })

  it('recusa tipo e quantidade errados', () => {
    expect(() => parseWriteTextArgs([])).toThrow()
    expect(() => parseWriteTextArgs([1])).toThrow()
    expect(() => parseWriteTextArgs(['a', 'b'])).toThrow()
  })
})

describe('canais agents:*, chat:* e clipboard:*', () => {
  const chat = {
    listAgents: vi.fn(async () => ({ ok: true as const, value: [] })),
    send: vi.fn(async () => ({ ok: false as const, error: { kind: 'unauthorized' as const } })),
    getTask: vi.fn(async () => ({ ok: false as const, error: { kind: 'unauthorized' as const } }))
  }
  const clipboard = { writeText: vi.fn() }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    setTrustedRenderer(rendererLocation({ kind: 'file' }, INDEX_HTML))
    registerChatHandlers(chat)
    registerClipboardHandlers(clipboard)
  })

  it('registra exatamente os quatro canais', () => {
    expect([...handlers.keys()].sort()).toEqual(['agents:list', 'chat:getTask', 'chat:send', 'clipboard:writeText'])
  })

  it('cada canal chega ao cliente com os argumentos', async () => {
    await invoke('agents:list')
    await invoke('chat:send', AGENT, 'oi', null)
    await invoke('chat:getTask', AGENT, 't-1')
    await invoke('clipboard:writeText', 'ctx-1')

    expect(chat.listAgents).toHaveBeenCalledWith()
    expect(chat.send).toHaveBeenCalledWith(AGENT, 'oi', null)
    expect(chat.getTask).toHaveBeenCalledWith(AGENT, 't-1')
    expect(clipboard.writeText).toHaveBeenCalledWith('ctx-1')
  })

  it.each([
    ['agents:list', ['x']],
    ['chat:send', ['../auth/login', 'oi', null]],
    ['chat:getTask', [AGENT, '../x']],
    ['clipboard:writeText', ['x'.repeat(1025)]]
  ])('%s com argumentos inválidos é rejeitado sem chamar o cliente', (channel, args) => {
    expect(() => invoke(channel, ...args)).toThrow(/Argumentos IPC inválidos/)
    expect(chat.listAgents).not.toHaveBeenCalled()
    expect(chat.send).not.toHaveBeenCalled()
    expect(chat.getTask).not.toHaveBeenCalled()
    expect(clipboard.writeText).not.toHaveBeenCalled()
  })

  it('a rejeição não repete nenhum valor, nem na cause', () => {
    const secret = 'senha123'.repeat(2001)
    const errors = [
      thrown(() => invoke('chat:send', '../segredo', 'senha123', null)),
      thrown(() => invoke('chat:send', AGENT, secret, null)),
      thrown(() => invoke('chat:getTask', '../segredo', 'senha123'))
    ]

    for (const error of errors) {
      const cause = error.cause as Error
      for (const text of [error.message, cause.message, String(cause.stack ?? '').split('\n')[0]]) {
        expect(text).not.toContain('segredo')
        expect(text).not.toContain('senha123')
      }
    }
  })
})
