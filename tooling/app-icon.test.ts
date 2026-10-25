import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TIE_RIGHT_WING } from '../src/shared/app-icon-geometry'
import { ICON_PATH, iconSvg, MAC_ICON_PATH, macSvg, render, SOURCE_PATH } from './app-icon'

const ROOT = join(import.meta.dirname, '..')
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Pixel RGBA de uma renderização em 1024 px. */
function pixelAt(image: { width: number; pixels: Buffer }, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4
  return [...image.pixels.subarray(i, i + 3)]
}

function expectColor(actual: number[], hex: string): void {
  const expected = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  actual.forEach((channel, i) => expect(Math.abs(channel - expected[i]!)).toBeLessThanOrEqual(4))
}

describe('origem do ícone (barra-de-status-e-marca, D6)', () => {
  const source = readFileSync(SOURCE_PATH)

  it('o SHA-256 do arquivo é o registrado no README de origem', () => {
    const readme = readFileSync(join(ROOT, 'assets/brand/README.md'), 'utf8')
    const [, registered] = /SHA-256 \| `([0-9a-f]{64})`/.exec(readme) ?? []

    expect(createHash('sha256').update(source).digest('hex')).toBe(registered)
  })

  it('o arquivo mantém o manifesto C2PA', () => {
    expect(source.toString('utf8')).toContain('<c2pa:manifest>')
  })
})

describe('peças geradas (D7)', () => {
  it.each([ICON_PATH, MAC_ICON_PATH])('%s é um PNG de 1024×1024', (path) => {
    const png = readFileSync(path)

    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)
  })

  it('o electron-builder usa os PNGs gerados', () => {
    const { build } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

    expect(build.icon).toBe('build/icon.png')
    expect(build.mac.icon).toBe('build/icon-mac.png')
  })

  it('o SVG montado sai da geometria corrigida, sem metadados nem C2PA', () => {
    const svg = iconSvg()

    expect(svg).toContain(TIE_RIGHT_WING)
    expect(svg).not.toMatch(/metadata|c2pa/i)
  })

  it('o SVG do macOS tem a arte em 824 px centralizada, sem filtro nem sombra', () => {
    const svg = macSvg()

    expect(svg).toContain('<svg x="100" y="100" width="824" height="824" viewBox="0 0 1024 1024">')
    expect(svg).toContain(TIE_RIGHT_WING)
    expect(svg).not.toMatch(/filter|shadow/i)
  })

  // Entre a asa direita e o nó: x 278, y 364 nas unidades do símbolo (D12).
  it('a gravata não tem o filete vazado do arquivo original', () => {
    expectColor(pixelAt(render(iconSvg()), 550, 701), '#ffffff')
    expectColor(pixelAt(render(readFileSync(SOURCE_PATH, 'utf8')), 550, 701), '#2a6ecb')
  })
})
