import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

function renderMarkdown(text: string) {
  return render(
    <MantineProvider>
      <Markdown text={text} />
    </MantineProvider>
  ).container
}

describe('Markdown das respostas', () => {
  it('HTML bruto aparece como texto, sem criar elementos', () => {
    const container = renderMarkdown('<b>oi</b><script>x()</script>')

    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<b>oi</b>')
  })

  it('link https vira <a> com href; javascript: não chega ao href', () => {
    const container = renderMarkdown('[docs](https://exemplo.com) e [x](javascript:alert(1))')

    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute('href', 'https://exemplo.com')
    for (const anchor of container.querySelectorAll('a')) {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
    }
  })

  it('o link não tem handler próprio: o clique fica com a guarda de navegação do main', () => {
    renderMarkdown('[docs](https://exemplo.com)')

    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('onclick')
  })

  it('imagem vira link, com o alt ou a URL; nenhum <img>', () => {
    const container = renderMarkdown('![gráfico](https://exemplo.com/g.png) ![](https://exemplo.com/h.png)')

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: 'gráfico' })).toHaveAttribute('href', 'https://exemplo.com/g.png')
    expect(screen.getByRole('link', { name: 'https://exemplo.com/h.png' })).toHaveAttribute(
      'href',
      'https://exemplo.com/h.png'
    )
  })

  it('código inline e em bloco na fonte monoespaçada do tema, com rolagem no bloco', () => {
    const container = renderMarkdown('use `npm test`\n\n```\nconst a = 1\n```')

    const codes = container.querySelectorAll('code')
    expect(codes).toHaveLength(2)
    for (const code of codes) expect(code.style.fontFamily).toBe('var(--mantine-font-family-monospace)')
    expect(container.querySelector('pre')).toHaveStyle({ overflowX: 'auto' })
  })

  it('tabela GFM vira table', () => {
    const container = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')

    const table = container.querySelector('table')!
    expect(table).not.toBeNull()
    expect(table.querySelectorAll('th')).toHaveLength(2)
    expect(table.querySelectorAll('td')).toHaveLength(2)
  })

  it('GFM: tachado e lista de tarefas', () => {
    const container = renderMarkdown('~~velho~~\n\n- [x] feito')

    expect(container.querySelector('del')).toHaveTextContent('velho')
    expect(container.querySelector('input[type="checkbox"]')).toBeChecked()
  })
})
