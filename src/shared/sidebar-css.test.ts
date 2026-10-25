import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A media query de largura estreita está no CSS global, que o jsdom não aplica (historico-conversas, D16 #5).
const globalCss = readFileSync(join(import.meta.dirname, '../renderer/src/styles/global.css'), 'utf8')

describe('lista de conversas na largura estreita', () => {
  it('continua visível, com altura máxima de 25vh, por classe (barra-de-status-e-marca, D9)', () => {
    const narrow = globalCss.slice(globalCss.indexOf('@media (max-width: 859.98px)'))
    const block = narrow.slice(0, narrow.indexOf('\n}\n'))
    const rule = block.slice(block.indexOf('.buteco-sidebar-history'))
    const body = rule.slice(rule.indexOf('{') + 1, rule.indexOf('}'))

    expect(body).toContain('max-height: 25vh')
    expect(body).not.toContain('display: none')
  })
})

/** Corpo da primeira regra `selector { … }` dentro de `css`. */
function ruleBody(css: string, selector: string): string {
  const rule = css.slice(css.indexOf(`${selector} {`))
  return rule.slice(rule.indexOf('{') + 1, rule.indexOf('}'))
}

describe('barra de status no rodapé da janela (barra-de-status-e-marca, D1)', () => {
  const narrow = globalCss.slice(globalCss.indexOf('@media (max-width: 859.98px)'))
  const narrowBlock = narrow.slice(0, narrow.indexOf('\n}\n'))

  it('a raiz é uma coluna: área de trabalho em cima e barra de status embaixo', () => {
    expect(ruleBody(globalCss, '.buteco-conversation')).toContain('flex-direction: column')
    expect(ruleBody(globalCss, '.buteco-workspace')).toContain('flex-direction: row')
  })

  it('a barra tem 26 px e não encolhe', () => {
    const body = ruleBody(globalCss, '.buteco-statusbar')

    expect(body).toContain('height: 26px')
    expect(body).toContain('flex-shrink: 0')
    expect(body).toContain('padding: 0 12px')
    expect(body).toContain('gap: 16px')
  })

  it('na largura estreita, só a área de trabalho vira coluna, e a barra continua visível', () => {
    expect(ruleBody(narrowBlock, '.buteco-workspace')).toContain('flex-direction: column')
    expect(narrowBlock).not.toContain('.buteco-conversation {')
    expect(narrowBlock).not.toMatch(/\.buteco-statusbar[^{]*{[^}]*display: none/)
  })
})
