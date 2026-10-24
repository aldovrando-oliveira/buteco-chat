import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld } }))

describe('preload', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    vi.resetModules()
  })

  it('expõe só window.buteco, vazio nesta change', async () => {
    await import('./index')

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(exposeInMainWorld).toHaveBeenCalledWith('buteco', {})
  })
})
