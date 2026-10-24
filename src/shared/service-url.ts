/**
 * Endereço do serviço (design D6 da login-operador). Usado pelo renderer (mensagens, valor salvo) e pelo main, que
 * decide. A forma normalizada (`baseUrl`) é a identidade do serviço: mudar a normalização é mudança de contrato.
 */
export type ServiceUrl =
  | {
      ok: true
      /** Origem + caminho, sem barras finais. As rotas são montadas por concatenação: `${baseUrl}/auth/login`. */
      baseUrl: string
      /** Host com porta, se houver. */
      host: string
      /** `http:` fora de loopback: a senha trafega sem criptografia. */
      insecure: boolean
    }
  | { ok: false }

export function parseServiceUrl(input: string): ServiceUrl {
  const value = input.trim()
  // Checado na string: `new URL('http://h/?')` tem `search === ''`.
  if (value === '' || value.includes('?') || value.includes('#')) return { ok: false }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false }
  if (url.username !== '' || url.password !== '' || url.hostname === '') return { ok: false }
  return {
    ok: true,
    baseUrl: url.origin + url.pathname.replace(/\/+$/, ''),
    host: url.host,
    insecure: url.protocol === 'http:' && !isLoopback(url.hostname)
  }
}

/** `hostname` já normalizado pelo `URL` (ex.: `127.1` → `127.0.0.1`, IPv6 entre colchetes). */
function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
}
