import {
  DEFAULT_THEME,
  defaultCssVariablesResolver,
  defaultVariantColorsResolver,
  mergeMantineTheme,
  type ConvertCSSVariablesInput
} from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../test/contrast'
import { cssVariablesResolver } from './css-variables'
import { theme } from './theme'

const fullTheme = mergeMantineTheme(DEFAULT_THEME, theme)

describe('tema (documento de construção)', () => {
  it('tem as seis escalas de cor', () => {
    expect(theme.colors).toEqual({
      butecoBlue: ['#f5f8fe', '#eef3fb', '#d6e3f6', '#b0c8ee', '#6495db', '#4180d4', '#2a6ecb', '#245cad', '#1e4d92', '#1a3f78'],
      green: ['#f3faf6', '#e9f6ee', '#cfe9dc', '#a0d7bd', '#4cc38a', '#33ab72', '#22935c', '#1e8853', '#1c814e', '#1a7a49'],
      yellow: ['#fdf8ee', '#fbf1de', '#f4e0bb', '#e8c489', '#e2a63f', '#c78c28', '#b07a1e', '#9d6a13', '#93620a', '#8a5a00'],
      red: ['#fef5f4', '#fdeceb', '#f9d3d0', '#f3aea7', '#f0766a', '#d94a3b', '#cf3a2b', '#c23325', '#b92e21', '#b02a1f'],
      gray: ['#fcfcfb', '#faf9f8', '#f1f1f1', '#e5e5e5', '#d5d4d2', '#8b9097', '#686d74', '#4d5157', '#33363b', '#191a1c'],
      dark: ['#e9eaec', '#c8cbd0', '#9aa0a8', '#7d838b', '#343639', '#2b2e34', '#24272c', '#1b1d21', '#16181b', '#121316']
    })
  })

  it('tem primário, tamanhos, alturas de linha, títulos e raios', () => {
    expect(theme.primaryColor).toBe('butecoBlue')
    expect(theme.primaryShade).toEqual({ light: 6, dark: 4 })
    expect(theme.fontSizes).toEqual({ xs: '11px', sm: '12px', md: '13px', lg: '14px', xl: '16px' })
    expect(theme.lineHeights).toEqual({ xs: '1.35', sm: '1.4', md: '1.45', lg: '1.5', xl: '1.55' })
    expect(theme.headings?.fontWeight).toBe('600')
    expect(Object.fromEntries(Object.entries(theme.headings?.sizes ?? {}).map(([k, v]) => [k, v.fontSize]))).toEqual({
      h1: '20px',
      h2: '17px',
      h3: '15px',
      h4: '14px',
      h5: '13px',
      h6: '12px'
    })
    expect(theme.radius).toEqual({ xs: '5px', sm: '7px', md: '9px', lg: '11px', xl: '14px' })
    expect(theme.defaultRadius).toBe('sm')
  })

  it('usa IBM Plex Sans e IBM Plex Mono', () => {
    expect(theme.fontFamily).toMatch(/^"IBM Plex Sans"/)
    expect(theme.headings?.fontFamily).toMatch(/^"IBM Plex Sans"/)
    expect(theme.fontFamilyMonospace).toMatch(/^"IBM Plex Mono"/)
  })
})

// Reproduz o que o MantineProvider faz: o resolvedor padrão mesclado com o nosso, por cima.
const defaults = defaultCssVariablesResolver(fullTheme)
const ours: ConvertCSSVariablesInput = cssVariablesResolver(fullTheme)
const merged = {
  variables: { ...defaults.variables, ...ours.variables },
  light: { ...defaults.light, ...ours.light },
  dark: { ...defaults.dark, ...ours.dark }
}

/** Resolve `var(--x)` até um valor literal, no esquema indicado. */
function resolve(value: string, scheme: 'light' | 'dark'): string {
  const reference = /^var\((--[\w-]+)\)$/.exec(value.trim())
  if (!reference) return value
  const name = reference[1] as `--${string}`
  const next = merged[scheme][name] ?? merged.variables[name]
  if (next === undefined) throw new Error(`Variável não definida no esquema ${scheme}: ${name}`)
  return resolve(next, scheme)
}

describe('primário preenchido (D10)', () => {
  const filled = defaultVariantColorsResolver({ color: 'butecoBlue', theme: fullTheme, variant: 'filled' })

  it('o resolvedor padrão do Mantine referencia a variável -filled', () => {
    expect(filled.background).toBe('var(--mantine-color-butecoBlue-filled)')
    expect(filled.color).toBe('var(--mantine-color-white)')
  })

  it.each(['light', 'dark'] as const)('texto branco sobre o preenchido tem ≥ 4,5:1 no esquema %s', (scheme) => {
    const background = resolve(filled.background, scheme)
    const text = resolve(filled.color, scheme)

    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5)
  })

  it('no escuro usa o tom 6 (hover 7), e o texto do primário continua no tom 4', () => {
    expect(resolve('var(--mantine-color-butecoBlue-filled)', 'dark')).toBe('#2a6ecb')
    expect(resolve('var(--mantine-color-butecoBlue-filled-hover)', 'dark')).toBe('#245cad')
    expect(resolve('var(--mantine-color-butecoBlue-text)', 'dark')).toBe('#6495db')
    expect(resolve('var(--mantine-color-anchor)', 'dark')).toBe('#6495db')
  })
})

describe('fundo da página e texto secundário (D10)', () => {
  it('não sobrescreve --mantine-color-body, que é a superfície', () => {
    expect(ours.light).not.toHaveProperty('--mantine-color-body')
    expect(ours.dark).not.toHaveProperty('--mantine-color-body')
    expect(resolve('var(--mantine-color-body)', 'light')).toBe('#fff')
    expect(resolve('var(--mantine-color-body)', 'dark')).toBe('#1b1d21')
  })

  it('define o fundo da página por esquema', () => {
    expect(resolve('var(--buteco-color-page)', 'light')).toBe('#f6f5f3')
    expect(resolve('var(--buteco-color-page)', 'dark')).toBe('#121316')
  })

  it.each([
    ['light', '--buteco-color-page'],
    ['light', '--mantine-color-body'],
    ['dark', '--buteco-color-page'],
    ['dark', '--mantine-color-body']
  ] as const)('texto secundário tem ≥ 4,5:1 no esquema %s sobre %s', (scheme, surface) => {
    const dimmed = resolve('var(--mantine-color-dimmed)', scheme)

    expect(contrastRatio(dimmed, resolve(`var(${surface})`, scheme))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('cores de erro e de aviso (login-operador, D12)', () => {
  it('definem os tons por esquema', () => {
    expect(resolve('var(--buteco-color-error-text)', 'light')).toBe('#b02a1f')
    expect(resolve('var(--buteco-color-error-text)', 'dark')).toBe('#f0766a')
    expect(resolve('var(--buteco-color-warning-text)', 'light')).toBe('#8a5a00')
    expect(resolve('var(--buteco-color-warning-text)', 'dark')).toBe('#e2a63f')
  })

  it.each([
    ['light', '--buteco-color-error-text', '--mantine-color-red-light'],
    ['dark', '--buteco-color-error-text', '--mantine-color-red-light'],
    ['light', '--buteco-color-warning-text', '--mantine-color-body'],
    ['dark', '--buteco-color-warning-text', '--mantine-color-body'],
    ['light', '--mantine-color-red-text', '--mantine-color-body'],
    ['dark', '--mantine-color-red-text', '--mantine-color-body']
  ] as const)('no esquema %s, %s sobre %s tem ≥ 4,5:1', (scheme, text, background) => {
    const ratio = contrastRatio(resolve(`var(${text})`, scheme), resolve(`var(${background})`, scheme))

    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('selo Ativo e balão do usuário (conversa-a2a, D19)', () => {
  it('define o texto de sucesso por esquema', () => {
    expect(resolve('var(--buteco-color-success-text)', 'light')).toBe('#1a7a49')
    expect(resolve('var(--buteco-color-success-text)', 'dark')).toBe('#4cc38a')
  })

  it.each([
    ['light', '--buteco-color-success-text', '--mantine-color-green-light'],
    ['dark', '--buteco-color-success-text', '--mantine-color-green-light'],
    ['light', '--mantine-color-text', '--mantine-color-butecoBlue-light'],
    ['dark', '--mantine-color-text', '--mantine-color-butecoBlue-light']
  ] as const)('no esquema %s, %s sobre %s tem ≥ 4,5:1', (scheme, text, background) => {
    const ratio = contrastRatio(resolve(`var(${text})`, scheme), resolve(`var(${background})`, scheme))

    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})

describe('banner de sessão expirada (sessao-expirada, D11 #8)', () => {
  it.each([
    ['light', '--buteco-color-warning-text'],
    ['dark', '--buteco-color-warning-text'],
    ['light', '--mantine-color-text'],
    ['dark', '--mantine-color-text']
  ] as const)('no esquema %s, %s sobre --mantine-color-yellow-light tem ≥ 4,5:1', (scheme, text) => {
    const ratio = contrastRatio(resolve(`var(${text})`, scheme), resolve('var(--mantine-color-yellow-light)', scheme))

    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})
