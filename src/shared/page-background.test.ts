import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_BACKGROUND } from './page-background'

const globalCss = readFileSync(join(import.meta.dirname, '../renderer/src/styles/global.css'), 'utf8')

describe('global.css', () => {
  it('o fundo estático do html usa as mesmas cores de PAGE_BACKGROUND', () => {
    const [, light] = /^html\s*{\s*background-color:\s*(#[0-9a-f]{6});/im.exec(globalCss) ?? []
    const [, dark] =
      /@media \(prefers-color-scheme: dark\)\s*{\s*html\s*{\s*background-color:\s*(#[0-9a-f]{6});/im.exec(globalCss) ?? []

    expect(light).toBe(PAGE_BACKGROUND.light)
    expect(dark).toBe(PAGE_BACKGROUND.dark)
  })
})
