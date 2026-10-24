// Verificações sobre a saída de `npm run build` (rodar `npm run build` antes de `npm run test:build`).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTION_CSP } from '../../tooling/csp'

const OUT = join(import.meta.dirname, '../../out')

function filesIn(dir: string): string[] {
  if (!existsSync(dir)) throw new Error(`${dir} não existe: rode \`npm run build\` antes.`)
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((name) => /\.\w+$/.test(name))
}

describe('preload (D4)', () => {
  const files = filesIn(join(OUT, 'preload'))

  it('é um único arquivo .js', () => {
    expect(files).toEqual(['index.js'])
  })

  it('é CommonJS e só faz require de electron', () => {
    const source = readFileSync(join(OUT, 'preload/index.js'), 'utf8')
    const requires = [...source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])

    expect(source).not.toMatch(/^\s*import[\s{*]/m)
    expect(source).not.toMatch(/^\s*export\s/m)
    expect(requires.length).toBeGreaterThan(0)
    expect(new Set(requires)).toEqual(new Set(['electron']))
  })
})

describe('renderer (D6, D11)', () => {
  const dir = join(OUT, 'renderer')
  const files = filesIn(dir)

  it('nenhum CSS ou JS contém URL data:', () => {
    const code = files.filter((name) => /\.(css|js)$/.test(name))
    expect(code.length).toBeGreaterThan(0)
    for (const name of code) {
      expect(readFileSync(join(dir, name), 'utf8'), name).not.toMatch(/data:[a-z]/i)
    }
  })

  it('as fontes Plex existem como arquivos .woff2', () => {
    const fonts = files.filter((name) => name.endsWith('.woff2'))
    for (const family of ['ibm-plex-sans-latin-400', 'ibm-plex-sans-latin-500', 'ibm-plex-sans-latin-600', 'ibm-plex-mono-latin-400', 'ibm-plex-mono-latin-500']) {
      expect(fonts.some((name) => name.includes(family)), family).toBe(true)
    }
  })

  it('o index.html tem exatamente a CSP de produção', () => {
    const html = readFileSync(join(dir, 'index.html'), 'utf8').replaceAll('&#39;', "'")
    const policies = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g)].map((m) => m[1])

    expect(policies).toEqual([PRODUCTION_CSP])
  })
})
