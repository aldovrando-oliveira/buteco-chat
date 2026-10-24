import { describe, expect, it } from 'vitest'
import { devServerOrigin, resolveRuntime } from './runtime'

describe('resolveRuntime', () => {
  it('em dev com ELECTRON_RENDERER_URL, usa o servidor de dev', () => {
    const runtime = resolveRuntime(false, 'http://localhost:5173')

    expect(runtime).toEqual({ kind: 'dev-server', url: 'http://localhost:5173/', origin: 'http://localhost:5173' })
    expect(devServerOrigin(runtime)).toBe('http://localhost:5173')
  })

  it('empacotado, ignora ELECTRON_RENDERER_URL e carrega o index.html', () => {
    const runtime = resolveRuntime(true, 'http://localhost:5173')

    expect(runtime).toEqual({ kind: 'file' })
    expect(devServerOrigin(runtime)).toBeNull()
  })

  it('sem servidor de dev, carrega o index.html', () => {
    expect(resolveRuntime(false, undefined)).toEqual({ kind: 'file' })
    expect(resolveRuntime(false, '')).toEqual({ kind: 'file' })
  })

  it('ignora valor que não é URL http(s)', () => {
    expect(resolveRuntime(false, 'file:///tmp/index.html')).toEqual({ kind: 'file' })
    expect(resolveRuntime(false, 'lixo')).toEqual({ kind: 'file' })
  })
})
