/**
 * Geometria do ícone do app, copiada de `assets/brand/app-icon.svg` (barra-de-status-e-marca, D5). É a fonte de tudo
 * o que o app desenha: o `AppIcon` do renderer e os PNGs de `tooling/app-icon.ts`. O arquivo continua a origem
 * registrada, sem edição.
 */

export const APP_ICON_VIEWBOX = '0 0 1024 1024'

export const APP_ICON_BLUE = '#2a6ecb'
export const APP_ICON_WHITE = '#ffffff'

/** Quadrado de canto 232 (22,7%). */
export const APP_ICON_RECT = { x: 0, y: 0, width: 1024, height: 1024, rx: 232, ry: 232 } as const

/** Transformações dos dois `<g>` aninhados, de fora para dentro. */
export const APP_ICON_TRANSFORMS = ['translate(302 232) scale(1.75)', 'translate(-136 -96)'] as const

/** Cabeça com os dois olhos vazados. */
export const HEAD_PATH =
  'M188 96H324A52 52 0 0 1 376 148V236A52 52 0 0 1 324 288H188A52 52 0 0 1 136 236V148A52 52 0 0 1 188 96ZM178 192A28 28 0 1 0 234 192A28 28 0 1 0 178 192ZM278 192A28 28 0 1 0 334 192A28 28 0 1 0 278 192Z'

export const TIE_LEFT_WING = 'M146 326Q146 312 160 312L236 346V382L160 416Q146 416 146 402Z'

/**
 * Correção local (D12): no original, esta asa é desenhada em sentido anti-horário, oposto ao da asa esquerda e do nó.
 * Com `fill-rule` nonzero, a faixa em que ela encosta no nó fica vazada (um filete azul à direita do nó). Aqui ficam
 * os mesmos pontos em sentido horário. Original: `M366 326Q366 312 352 312L276 346V382L352 416Q366 416 366 402Z`.
 */
export const TIE_RIGHT_WING = 'M366 326V402Q366 416 352 416L276 382V346L352 312Q366 312 366 326Z'

export const TIE_KNOT =
  'M248 330H264A16 16 0 0 1 280 346V382A16 16 0 0 1 264 398H248A16 16 0 0 1 232 382V346A16 16 0 0 1 248 330Z'

/** Os dois caminhos brancos, na ordem do arquivo: a cabeça e a gravata (asa esquerda, asa direita e nó). */
export const APP_ICON_PATHS = [
  { d: HEAD_PATH, fillRule: 'evenodd' },
  { d: `${TIE_LEFT_WING}${TIE_RIGHT_WING}${TIE_KNOT}`, fillRule: null }
] as const
