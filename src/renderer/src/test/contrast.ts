/** Contraste WCAG 2.x entre duas cores `#rrggbb`, `#rgb` ou `rgb()`/`rgba()` opaca. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

function luminance(color: string): number {
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*1)?\)$/.exec(color)
  const hexColor = rgb ? '#' + rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('') : color
  const hex = /^#[0-9a-f]{3}$/i.test(hexColor) ? '#' + [...hexColor.slice(1)].map((c) => c + c).join('') : hexColor
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Cor fora do formato #rrggbb: ${color}`)
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
