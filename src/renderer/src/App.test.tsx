import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionLabel } from './components/SectionLabel'
import indexHtml from '../index.html?raw'

describe('interface em pt-BR', () => {
  it('o index.html declara pt-BR', () => {
    expect(indexHtml).toMatch(/<html lang="pt-BR">/)
  })
})

describe('SectionLabel', () => {
  it('tem 11px, caixa alta, letter-spacing 0.05em e texto secundário', () => {
    render(
      <MantineProvider>
        <SectionLabel>Fundação</SectionLabel>
      </MantineProvider>
    )
    const label = screen.getByText('Fundação')

    // O Mantine converte 11px em rem: 0.6875rem × --mantine-scale (1) = 11px.
    expect(label.style.fontSize).toBe('calc(0.6875rem * var(--mantine-scale))')
    expect(label.style.textTransform).toBe('uppercase')
    expect(label.style.letterSpacing).toBe('0.05em')
    expect(label.style.color).toBe('var(--mantine-color-dimmed)')
  })
})
