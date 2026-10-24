import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A media query de largura estreita está no CSS global, que o jsdom não aplica (historico-conversas, D16 #5).
const globalCss = readFileSync(join(import.meta.dirname, '../renderer/src/styles/global.css'), 'utf8')

describe('lista de conversas na largura estreita', () => {
  it('continua visível, com altura máxima de 30vh, por classe', () => {
    const narrow = globalCss.slice(globalCss.indexOf('@media (max-width: 859.98px)'))
    const block = narrow.slice(0, narrow.indexOf('\n}\n'))
    const rule = block.slice(block.indexOf('.buteco-sidebar-history'))
    const body = rule.slice(rule.indexOf('{') + 1, rule.indexOf('}'))

    expect(body).toContain('max-height: 30vh')
    expect(body).not.toContain('display: none')
  })
})
