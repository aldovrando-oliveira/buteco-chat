import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TIE_RIGHT_WING } from '../src/shared/app-icon-geometry'
import {
  ICON_PATH,
  iconSvg,
  LINUX_ICON_SIZES,
  LINUX_ICONS_DIR,
  linuxIconSvg,
  MAC_ICON_PATH,
  macSvg,
  render,
  SOURCE_PATH
} from './app-icon'

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

describe('tamanhos do Linux (empacotamento-linux-windows, D2)', () => {
  it('build/icons tem exatamente os oito tamanhos do hicolor', () => {
    expect(readdirSync(LINUX_ICONS_DIR).sort()).toEqual(LINUX_ICON_SIZES.map((n) => `${n}x${n}.png`).sort())
  })

  it.each(LINUX_ICON_SIZES)('%i px é um PNG do tamanho do nome, igual ao gerado agora', (n) => {
    const png = readFileSync(join(LINUX_ICONS_DIR, `${n}x${n}.png`))

    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
    expect(png.readUInt32BE(16)).toBe(n)
    expect(png.readUInt32BE(20)).toBe(n)
    expect(png.equals(render(linuxIconSvg(), n).png())).toBe(true)
  })

  // Perto da borda esquerda, a meia altura: dentro do quadrado inteiro, fora da arte de 824 px do macOS.
  it('o SVG do Linux é o do quadro inteiro, sem a margem do macOS', () => {
    const at = (svg: string) => [...render(svg, 512).pixels.subarray((256 * 512 + 20) * 4, (256 * 512 + 20) * 4 + 4)]

    expect(linuxIconSvg()).toBe(iconSvg())
    expectColor(at(linuxIconSvg()).slice(0, 3), '#2a6ecb')
    expect(at(linuxIconSvg())[3]).toBe(255)
    expect(at(macSvg())[3]).toBe(0)
  })
})

describe('configuração por sistema (empacotamento-linux-windows, D9)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const { build } = pkg

  it('dir no macOS e no Windows, deb no Linux', () => {
    expect(build.mac.target).toBe('dir')
    expect(build.win.target).toBe('dir')
    expect(build.linux.target).toBe('deb')
  })

  it('o Linux usa build/icons e o Windows herda build.icon', () => {
    expect(build.linux.icon).toBe('build/icons')
    expect(build.win).not.toHaveProperty('icon')
    expect(build.icon).toBe('build/icon.png')
    expect(build.mac.icon).toBe('build/icon-mac.png')
  })

  it('o .desktop, o executável e a categoria do Linux combinam', () => {
    expect(pkg.desktopName).toBe('buteco-chat.desktop')
    expect(build.linux.syncDesktopName).toBe(true)
    expect(build.linux.executableName).toBe('buteco-chat')
    expect(pkg.desktopName.replace(/\.desktop$/, '')).toBe(build.linux.executableName)
    expect(build.linux.category).toBe('Development')
  })

  it('o deb tem mantenedor com e-mail e homepage', () => {
    expect(build.linux.maintainer).toMatch(/^[^<>]+ <[^<>\s]+@[^<>\s]+\.[^<>\s]+>$/)
    expect(pkg.homepage).toMatch(/^https:\/\//)
  })

  it('sem publicação, sem rebuild nativo e sem assinatura no macOS', () => {
    expect(build.publish).toBeNull()
    expect(build.npmRebuild).toBe(false)
    expect(build.mac.identity).toBeNull()
  })
})
