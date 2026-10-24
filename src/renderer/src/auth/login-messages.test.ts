import { describe, expect, it } from 'vitest'
import { loginErrorMessage } from './login-messages'

const address = 'https://host'

describe('loginErrorMessage', () => {
  it('credenciais inválidas', () => {
    expect(loginErrorMessage({ kind: 'invalid-credentials' }, address)).toBe('Usuário ou senha incorretos.')
  })

  it('serviço inalcançável', () => {
    expect(loginErrorMessage({ kind: 'unreachable', message: 'timeout' }, 'http://localhost:5017')).toBe(
      'Não foi possível conectar a http://localhost:5017. Confira o endereço e se o serviço está no ar.'
    )
  })

  it.each([404, 500])('erro HTTP %i', (status) => {
    expect(loginErrorMessage({ kind: 'http', status }, address)).toBe(
      `O serviço em https://host respondeu com erro ${status}. Confira o endereço.`
    )
  })

  it.each([0, 301, 307, 399])('redirecionamento (%i), sem "erro N"', (status) => {
    const message = loginErrorMessage({ kind: 'http', status }, address)

    expect(message).toBe(
      'O serviço em https://host respondeu com um redirecionamento, que o app não segue. Confira o endereço (por exemplo, https:// em vez de http://).'
    )
    expect(message).not.toMatch(/erro \d/)
  })

  it('resposta inesperada', () => {
    expect(loginErrorMessage({ kind: 'bad-response' }, address)).toBe(
      'O serviço em https://host deu uma resposta inesperada. Confira o endereço.'
    )
  })
})
