import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPOSED_NAMESPACES } from '../shared/api'

const exposeInMainWorld = vi.fn()
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld } }))

describe('preload', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    vi.resetModules()
  })

  it('expõe só window.buteco, com exatamente os namespaces de ExposedApi', async () => {
    await import('./index')

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    const [name, api] = exposeInMainWorld.mock.calls[0] ?? []
    expect(name).toBe('buteco')
    expect(Object.keys(api as object).sort()).toEqual([...EXPOSED_NAMESPACES].sort())
  })
})
