import type { HtmlTagDescriptor, ResolvedConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { cspPlugin, developmentCsp, PRODUCTION_CSP } from './csp'

function injectedPolicy(command: 'build' | 'serve', port = 5173): string {
  const plugin = cspPlugin()
  const configResolved = plugin.configResolved as (config: ResolvedConfig) => void
  configResolved({ command, server: { port } } as ResolvedConfig)
  const transform = plugin.transformIndexHtml as () => HtmlTagDescriptor[]
  const [tag] = transform()
  expect(tag?.tag).toBe('meta')
  expect(tag?.attrs?.['http-equiv']).toBe('Content-Security-Policy')
  expect(tag?.injectTo).toBe('head-prepend')
  return String(tag?.attrs?.['content'])
}

describe('CSP de produção', () => {
  it('é exatamente a do design (D6)', () => {
    expect(PRODUCTION_CSP).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; " +
        "connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'"
    )
  })

  it('é a injetada no build, sem unsafe-inline em script-src nem ws:', () => {
    const policy = injectedPolicy('build')

    expect(policy).toBe(PRODUCTION_CSP)
    expect(policy).not.toContain('ws:')
    expect(policy.split('; ').find((d) => d.startsWith('script-src'))).toBe("script-src 'self'")
  })
})

describe('CSP de dev', () => {
  it('é injetada no serve e libera só a origem exata do dev server', () => {
    const policy = injectedPolicy('serve', 5173)

    expect(policy).toBe(developmentCsp(5173))
    expect(policy).toContain('connect-src http://localhost:5173 ws://localhost:5173;')
    expect(policy).not.toContain('5017')
    expect(policy).not.toContain("connect-src 'self'")
  })
})
