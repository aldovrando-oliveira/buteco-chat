import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_ICON_BLUE,
  APP_ICON_PATHS,
  APP_ICON_RECT,
  APP_ICON_TRANSFORMS,
  APP_ICON_VIEWBOX,
  APP_ICON_WHITE,
  TIE_RIGHT_WING
} from './app-icon-geometry'

// Arquivo da plataforma, sem edição (barra-de-status-e-marca, D6). As constantes o seguem, exceto a asa direita (D12).
const source = readFileSync(join(import.meta.dirname, '../../assets/brand/app-icon.svg'), 'utf8')

const ORIGINAL_RIGHT_WING = 'M366 326Q366 312 352 312L276 346V382L352 416Q366 416 366 402Z'

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]))
}

function tags(name: string): Record<string, string>[] {
  return [...source.matchAll(new RegExp(`<${name}\\s[^>]*>`, 'g'))].map((m) => attributes(m[0]))
}

describe('geometria do ícone do app', () => {
  it('o arquivo tem o subcaminho original da asa direita, uma única vez', () => {
    expect(source.split(ORIGINAL_RIGHT_WING)).toHaveLength(2)
  })

  it('o viewBox é o do arquivo', () => {
    expect(tags('svg')[0]!['viewBox']).toBe(APP_ICON_VIEWBOX)
  })

  it('o quadrado é o do arquivo', () => {
    const rects = tags('rect')
    expect(rects).toHaveLength(1)
    const { x, y, width, height, rx, ry, fill } = rects[0]!
    expect({ x, y, width, height, rx, ry }).toEqual(
      Object.fromEntries(Object.entries(APP_ICON_RECT).map(([key, value]) => [key, String(value)]))
    )
    expect(fill).toBe(APP_ICON_BLUE)
  })

  it('as transformações são as do arquivo, na mesma ordem', () => {
    expect(tags('g').map((g) => g['transform'])).toEqual([...APP_ICON_TRANSFORMS])
  })

  it('os caminhos são os do arquivo, exceto a asa direita, que vem invertida', () => {
    const paths = tags('path')
    expect(paths).toHaveLength(APP_ICON_PATHS.length)
    paths.forEach((path, index) => {
      const expected = APP_ICON_PATHS[index]!
      expect(path['d']!.replace(ORIGINAL_RIGHT_WING, TIE_RIGHT_WING), `d do caminho ${index}`).toBe(expected.d)
      expect(path['fill'], `fill do caminho ${index}`).toBe(APP_ICON_WHITE)
      expect(path['fill-rule'] ?? null, `fill-rule do caminho ${index}`).toBe(expected.fillRule)
    })
  })

  it('a asa direita corrigida tem os mesmos pontos da original, em sentido inverso', () => {
    expect(TIE_RIGHT_WING).toBe('M366 326V402Q366 416 352 416L276 382V346L352 312Q366 312 366 326Z')
    expect(APP_ICON_PATHS[1].d).toContain(TIE_RIGHT_WING)
    expect(APP_ICON_PATHS[1].d).not.toContain(ORIGINAL_RIGHT_WING)
  })
})
