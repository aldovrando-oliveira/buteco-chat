import {
  APP_ICON_BLUE,
  APP_ICON_PATHS,
  APP_ICON_RECT,
  APP_ICON_TRANSFORMS,
  APP_ICON_VIEWBOX,
  APP_ICON_WHITE
} from '../../../shared/app-icon-geometry'

/** Abaixo de 24 px a gravata some (manual da marca). */
export const APP_ICON_MIN_SIZE = 24

/**
 * Ícone do app, a marca dentro da interface (identidade-visual, 'Ícone do app na interface'): SVG inline a partir da
 * geometria compartilhada com os PNGs, cores fixas nos dois esquemas e fora da árvore de acessibilidade (o nome vem do
 * texto ao lado).
 */
export function AppIcon({ size }: { size: number }) {
  const side = Math.max(APP_ICON_MIN_SIZE, size)
  const [outer, inner] = APP_ICON_TRANSFORMS
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={APP_ICON_VIEWBOX}
      width={side}
      height={side}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect {...APP_ICON_RECT} fill={APP_ICON_BLUE} />
      <g transform={outer}>
        <g transform={inner}>
          {APP_ICON_PATHS.map(({ d, fillRule }) => (
            <path key={d} d={d} fill={APP_ICON_WHITE} fillRule={fillRule ?? undefined} />
          ))}
        </g>
      </g>
    </svg>
  )
}
