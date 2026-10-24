import { pathToFileURL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Listener>()
const fromWebContents = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, listener: Listener) => handlers.set(channel, listener) },
  BrowserWindow: { fromWebContents: (contents: unknown) => fromWebContents(contents) }
}))

const { handle, isTrustedSender, rendererLocation, setTrustedRenderer } = await import('./handle')

const INDEX_HTML = '/Applications/Buteco Chat.app/Contents/Resources/app.asar/out/renderer/index.html'
const fileLocation = rendererLocation({ kind: 'file' }, INDEX_HTML)
const devLocation = rendererLocation(
  { kind: 'dev-server', url: 'http://localhost:5173/', origin: 'http://localhost:5173' },
  INDEX_HTML
)
const indexUrl = pathToFileURL(INDEX_HTML).href

function mainFrame(url: string) {
  return { url, parent: null }
}

describe('rendererLocation', () => {
  it('monta o caminho com pathToFileURL (espaço vira %20)', () => {
    expect(fileLocation).toEqual({
      kind: 'file',
      pathname: '/Applications/Buteco%20Chat.app/Contents/Resources/app.asar/out/renderer/index.html'
    })
  })

  it('em dev, guarda só a origem', () => {
    expect(devLocation).toEqual({ kind: 'dev', origin: 'http://localhost:5173' })
  })
})

describe('isTrustedSender (produção)', () => {
  it('aceita o index.html do app, em caminho com espaço', () => {
    expect(isTrustedSender(mainFrame(indexUrl), true, fileLocation)).toBe(true)
  })

  it.each(['#/conversas', '?x=1', '?x=1#/conversas'])('ignora hash e query: %s', (suffix) => {
    expect(isTrustedSender(mainFrame(indexUrl + suffix), true, fileLocation)).toBe(true)
  })

  it('rejeita outro index.html em caminho diferente', () => {
    expect(isTrustedSender(mainFrame('file:///tmp/outro/index.html'), true, fileLocation)).toBe(false)
  })

  it('rejeita outra origem, inclusive o dev server', () => {
    expect(isTrustedSender(mainFrame('https://malicioso.exemplo/'), true, fileLocation)).toBe(false)
    expect(isTrustedSender(mainFrame('http://localhost:5173/'), true, fileLocation)).toBe(false)
  })

  it('rejeita subframe, frame nulo e webContents que não é janela do app', () => {
    expect(isTrustedSender({ url: indexUrl, parent: {} }, true, fileLocation)).toBe(false)
    expect(isTrustedSender(null, true, fileLocation)).toBe(false)
    expect(isTrustedSender(mainFrame(indexUrl), false, fileLocation)).toBe(false)
  })
})

describe('isTrustedSender (dev)', () => {
  it('aceita a origem do dev server, com qualquer caminho, hash ou query', () => {
    expect(isTrustedSender(mainFrame('http://localhost:5173/'), true, devLocation)).toBe(true)
    expect(isTrustedSender(mainFrame('http://localhost:5173/?x=1#/conversas'), true, devLocation)).toBe(true)
  })

  it('rejeita porta ou host diferente', () => {
    expect(isTrustedSender(mainFrame('http://localhost:5174/'), true, devLocation)).toBe(false)
    expect(isTrustedSender(mainFrame('http://127.0.0.1:5173/'), true, devLocation)).toBe(false)
  })
})

describe('handle', () => {
  beforeEach(() => {
    handlers.clear()
    fromWebContents.mockReset()
    setTrustedRenderer(fileLocation)
  })

  function invoke(channel: string, frame: { url: string; parent: unknown } | null, ...args: unknown[]) {
    const listener = handlers.get(channel)
    if (!listener) throw new Error(`canal ${channel} não registrado`)
    return listener({ sender: {}, senderFrame: frame }, ...args)
  }

  /** Validador manual de exemplo: exatamente dois números. */
  function twoNumbers(args: unknown[]): [number, number] {
    const [a, b] = args
    if (args.length !== 2 || typeof a !== 'number' || typeof b !== 'number') throw new TypeError('esperado (number, number)')
    return [a, b]
  }

  it('executa o handler com os argumentos validados e devolve o valor', async () => {
    fromWebContents.mockReturnValue({})
    const fn = vi.fn((a: number, b: number) => a + b)
    handle('teste:soma', twoNumbers, fn)

    await expect(Promise.resolve(invoke('teste:soma', mainFrame(indexUrl + '#/x'), 2, 3))).resolves.toBe(5)
    expect(fn).toHaveBeenCalledWith(2, 3)
  })

  it.each([
    ['tipo errado', ['2', 3]],
    ['faltando argumento', [2]],
    ['argumento a mais', [2, 3, 4]]
  ])('rejeita argumentos inválidos sem executar o handler: %s', (_label, args) => {
    fromWebContents.mockReturnValue({})
    const fn = vi.fn()
    handle('teste:args', twoNumbers, fn)

    expect(() => invoke('teste:args', mainFrame(indexUrl), ...args)).toThrow(/Argumentos IPC inválidos em teste:args/)
    expect(fn).not.toHaveBeenCalled()
  })

  it.each([
    ['outra origem', mainFrame('https://malicioso.exemplo/')],
    ['outro index.html', mainFrame('file:///tmp/outro/index.html')],
    ['subframe', { url: indexUrl, parent: {} }],
    ['frame nulo', null]
  ])('rejeita o remetente antes de validar argumentos e sem executar o handler: %s', (_label, frame) => {
    fromWebContents.mockReturnValue({})
    const parseArgs = vi.fn(twoNumbers)
    const fn = vi.fn()
    handle('teste:rejeita', parseArgs, fn)

    expect(() => invoke('teste:rejeita', frame, 2, 3)).toThrow(/não autorizado/)
    expect(parseArgs).not.toHaveBeenCalled()
    expect(fn).not.toHaveBeenCalled()
  })

  it('rejeita quando o webContents não é de uma janela do app', () => {
    fromWebContents.mockReturnValue(null)
    const fn = vi.fn()
    handle('teste:janela', twoNumbers, fn)

    expect(() => invoke('teste:janela', mainFrame(indexUrl), 2, 3)).toThrow(/não autorizado/)
    expect(fn).not.toHaveBeenCalled()
  })
})
