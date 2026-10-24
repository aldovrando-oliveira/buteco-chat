import { describe, expect, it, vi } from 'vitest'
import { devUserDataPath, focusOrOpen } from './instance'

function window(minimized: boolean) {
  return { isMinimized: vi.fn(() => minimized), restore: vi.fn(), focus: vi.fn() }
}

describe('devUserDataPath', () => {
  it('acrescenta o sufixo (dev) à pasta padrão', () => {
    expect(devUserDataPath('/Users/x/Library/Application Support/Buteco Chat')).toBe(
      '/Users/x/Library/Application Support/Buteco Chat (dev)'
    )
  })
})

describe('focusOrOpen', () => {
  it('foca a janela existente sem abrir outra', () => {
    const existing = window(false)
    const open = vi.fn()

    focusOrOpen([existing], open)

    expect(existing.focus).toHaveBeenCalledOnce()
    expect(existing.restore).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('restaura a janela minimizada antes de focar', () => {
    const existing = window(true)

    focusOrOpen([existing], vi.fn())

    expect(existing.restore).toHaveBeenCalledOnce()
    expect(existing.focus).toHaveBeenCalledOnce()
  })

  it('abre uma janela quando não há nenhuma', () => {
    const open = vi.fn()

    focusOrOpen([], open)

    expect(open).toHaveBeenCalledOnce()
  })
})
