import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  APP_ICON_BLUE,
  APP_ICON_PATHS,
  APP_ICON_RECT,
  APP_ICON_TRANSFORMS,
  APP_ICON_VIEWBOX,
  APP_ICON_WHITE
} from '../../../shared/app-icon-geometry'
import { AppIcon } from './AppIcon'

// A fidelidade ao arquivo da marca é testada no projeto main (src/shared/app-icon-geometry.test.ts); aqui, só que o
// componente desenha a partir das constantes (identidade-visual, 'Ícone do app na interface').
function renderIcon(size: number, scheme: 'light' | 'dark' = 'light') {
  const { container } = render(
    <MantineProvider forceColorScheme={scheme}>
      <AppIcon size={size} />
    </MantineProvider>
  )
  return container.querySelector('svg')!
}

describe('AppIcon', () => {
  it('desenha a partir das constantes de geometria', () => {
    const svg = renderIcon(32)
    const rect = svg.querySelector('rect')!

    expect(svg.getAttribute('viewBox')).toBe(APP_ICON_VIEWBOX)
    for (const [name, value] of Object.entries(APP_ICON_RECT)) expect(rect.getAttribute(name), name).toBe(String(value))
    expect([...svg.querySelectorAll('g')].map((g) => g.getAttribute('transform'))).toEqual([...APP_ICON_TRANSFORMS])
    expect(
      [...svg.querySelectorAll('path')].map((path) => ({ d: path.getAttribute('d'), fillRule: path.getAttribute('fill-rule') }))
    ).toEqual(APP_ICON_PATHS.map(({ d, fillRule }) => ({ d, fillRule })))
  })

  it.each([
    [16, '24'],
    [24, '24'],
    [32, '32']
  ])('com tamanho %i, desenha com %s px (mínimo de 24)', (size, side) => {
    const svg = renderIcon(size)

    expect(svg.getAttribute('width')).toBe(side)
    expect(svg.getAttribute('height')).toBe(side)
    expect(svg.getAttribute('viewBox')).toBe('0 0 1024 1024')
  })

  it.each(['light', 'dark'] as const)('cores fixas no esquema %s, sem variáveis do tema', (scheme) => {
    const svg = renderIcon(24, scheme)

    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe(APP_ICON_BLUE)
    for (const path of svg.querySelectorAll('path')) expect(path.getAttribute('fill')).toBe(APP_ICON_WHITE)
    expect(svg.outerHTML).not.toContain('var(')
  })

  it('fica fora da árvore de acessibilidade', () => {
    const svg = renderIcon(24)

    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.hasAttribute('role')).toBe(false)
    expect(svg.hasAttribute('aria-label')).toBe(false)
    expect(svg.querySelector('title')).toBeNull()
  })
})
