import { IpcChannels } from '../../shared/ipc-channels'
import { parseServiceUrl } from '../../shared/service-url'
import { handle } from '../ipc/handle'
import type { AuthService } from './service'

export const LOGIN_ARG_LIMITS = { serviceUrl: 2048, username: 256, password: 1024 } as const

// Mensagens fixas, sem nenhum valor recebido: o Electron imprime no stderr o erro de um handler que rejeita,
// com a `cause` (design D7). Um endereço com credenciais embutidas vazaria a senha no log.

/** `auth:login`: exatamente (serviceUrl, username, password), strings dentro dos limites, endereço válido. */
export function parseLoginArgs(args: unknown[]): [string, string, string] {
  if (args.length !== 3) throw new TypeError('auth:login espera 3 argumentos.')
  const [serviceUrl, username, password] = args
  if (typeof serviceUrl !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    throw new TypeError('auth:login espera 3 strings.')
  }
  if (serviceUrl.length > LOGIN_ARG_LIMITS.serviceUrl) throw new RangeError('serviceUrl excede o limite.')
  if (username.length > LOGIN_ARG_LIMITS.username) throw new RangeError('username excede o limite.')
  if (password.length > LOGIN_ARG_LIMITS.password) throw new RangeError('password excede o limite.')
  if (!parseServiceUrl(serviceUrl).ok) throw new TypeError('serviceUrl inválido.')
  return [serviceUrl, username, password]
}

/** `auth:logout` e `auth:status`: nenhum argumento. */
export function parseNoArgs(args: unknown[]): [] {
  if (args.length !== 0) throw new TypeError('canal sem argumentos recebeu argumentos.')
  return []
}

/** Registra os canais `auth:*`. `getToken` não tem canal: o token nunca cruza a ponte. */
export function registerAuthHandlers(auth: AuthService): void {
  handle(IpcChannels.authLogin, parseLoginArgs, (serviceUrl, username, password) =>
    auth.login(serviceUrl, username, password)
  )
  handle(IpcChannels.authLogout, parseNoArgs, () => auth.logout())
  handle(IpcChannels.authStatus, parseNoArgs, () => auth.status())
}
