import { describe, expect, it } from 'vitest'
import { parseServiceUrl } from './service-url'

describe('parseServiceUrl', () => {
  it('aceita o endereço local', () => {
    expect(parseServiceUrl('http://localhost:5017')).toEqual({
      ok: true,
      baseUrl: 'http://localhost:5017',
      host: 'localhost:5017',
      insecure: false
    })
  })

  it('remove espaços e barra final, e normaliza o host', () => {
    expect(parseServiceUrl('  https://Exemplo.com/  ')).toMatchObject({ ok: true, baseUrl: 'https://exemplo.com' })
    expect(parseServiceUrl('http://host:80/')).toMatchObject({ ok: true, baseUrl: 'http://host', host: 'host' })
  })

  it('preserva o prefixo de caminho', () => {
    const result = parseServiceUrl('https://host/buteco/')

    expect(result).toMatchObject({ ok: true, baseUrl: 'https://host/buteco', host: 'host' })
    if (!result.ok) throw new Error('esperado ok')
    expect(`${result.baseUrl}/auth/login`).toBe('https://host/buteco/auth/login')
  })

  it('documenta por que as rotas são concatenadas: a resolução relativa descarta o prefixo', () => {
    expect(new URL('auth/login', 'https://host/buteco').href).toBe('https://host/auth/login')
  })

  it.each([
    '',
    '   ',
    'localhost:5017',
    'ftp://host',
    'file:///x',
    'http://user:pass@host',
    'http://user@host',
    'http://host/?x=1',
    'http://host/?',
    'http://host/#a',
    'http://host#',
    'não é url'
  ])('recusa %j', (input) => {
    expect(parseServiceUrl(input)).toEqual({ ok: false })
  })

  it.each([
    ['http://192.168.0.10:5017', true],
    ['http://servidor.interno', true],
    ['http://127.0.0.1:5017', false],
    ['http://127.1:5017', false],
    ['http://[::1]:5017', false],
    ['http://localhost', false],
    ['https://servidor.interno', false]
  ])('insecure de %s é %s', (input, insecure) => {
    expect(parseServiceUrl(input)).toMatchObject({ ok: true, insecure })
  })
})
