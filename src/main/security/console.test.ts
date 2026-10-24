import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { forwardConsoleMessages } from './console'

// Formato do Electron 45: um único objeto de evento com `level` textual (os argumentos posicionais são obsoletos).
function consoleEvent(level: 'info' | 'warning' | 'error' | 'debug', message: string) {
  return { level, message, lineNumber: 3, sourceId: 'file:///app/index.html', frame: null, preventDefault() {} }
}

describe('forwardConsoleMessages', () => {
  it('repassa warning e error ao stdout, e descarta info e debug', () => {
    let listener: ((details: ReturnType<typeof consoleEvent>) => void) | undefined
    const contents = {
      on: vi.fn((name: string, fn: typeof listener) => {
        if (name === 'console-message') listener = fn
      })
    } as unknown as WebContents
    const write = vi.fn()

    forwardConsoleMessages(contents, write)
    listener?.(consoleEvent('warning', 'aviso'))
    listener?.(consoleEvent('error', "Refused to connect because it violates the document's Content Security Policy."))
    listener?.(consoleEvent('info', 'informação'))
    listener?.(consoleEvent('debug', 'depuração'))

    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenNthCalledWith(1, '[renderer:warning] aviso (file:///app/index.html:3)\n')
    expect(write.mock.calls[1]?.[0]).toContain('[renderer:error] Refused to connect')
  })
})
