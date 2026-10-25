import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import {
  APP_ICON_BLUE,
  APP_ICON_PATHS,
  APP_ICON_RECT,
  APP_ICON_TRANSFORMS,
  APP_ICON_VIEWBOX,
  APP_ICON_WHITE
} from '../src/shared/app-icon-geometry.ts'

/**
 * Peças do ícone do app, geradas a partir da geometria de `src/shared/app-icon-geometry.ts` (barra-de-status-e-marca,
 * D7), que já tem a correção da gravata (D12). `assets/brand/app-icon.svg` é só a origem registrada. Rodar com
 * `npm run icons`; os PNGs ficam no git.
 */

const ROOT = join(import.meta.dirname, '..')
export const SOURCE_PATH = join(ROOT, 'assets/brand/app-icon.svg')
export const ICON_PATH = join(ROOT, 'build/icon.png')
export const MAC_ICON_PATH = join(ROOT, 'build/icon-mac.png')

export const SIZE = 1024
/** Grid de ícones do macOS (Big Sur em diante): quadrado de 824 centralizado no quadro de 1024. */
export const MAC_ART_SIZE = 824
const MAC_OFFSET = (SIZE - MAC_ART_SIZE) / 2

/** A arte (quadrado e símbolo), sem a raiz `<svg>` e sem metadados. */
export function artSvg(): string {
  const { x, y, width, height, rx, ry } = APP_ICON_RECT
  const [outer, inner] = APP_ICON_TRANSFORMS
  const paths = APP_ICON_PATHS.map(
    ({ d, fillRule }) => `<path${fillRule ? ` fill-rule="${fillRule}"` : ''} fill="${APP_ICON_WHITE}" d="${d}"/>`
  ).join('')
  return (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${ry}" fill="${APP_ICON_BLUE}"/>` +
    `<g transform="${outer}"><g transform="${inner}">${paths}</g></g>`
  )
}

/** O ícone no quadro inteiro. */
export function iconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${APP_ICON_VIEWBOX}">${artSvg()}</svg>`
}

/** O ícone inteiro reduzido a 824/1024 e centralizado num quadro transparente, sem sombra (D7). */
export function macSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<svg x="${MAC_OFFSET}" y="${MAC_OFFSET}" width="${MAC_ART_SIZE}" height="${MAC_ART_SIZE}" viewBox="${APP_ICON_VIEWBOX}">` +
    artSvg() +
    '</svg></svg>'
  )
}

/** Renderiza em 1024 px de largura. */
export function render(svg: string): { width: number; pixels: Buffer; png: () => Buffer } {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render()
  return { width: image.width, pixels: image.pixels, png: () => image.asPng() }
}

export function generateIcons(): void {
  mkdirSync(dirname(ICON_PATH), { recursive: true })
  writeFileSync(ICON_PATH, render(iconSvg()).png())
  writeFileSync(MAC_ICON_PATH, render(macSvg()).png())
}

if (import.meta.main) generateIcons()
