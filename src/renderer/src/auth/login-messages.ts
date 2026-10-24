import type { ChatError } from '../../../shared/api'

export const INVALID_ADDRESS_MESSAGE = 'Informe um endereço completo, começando com http:// ou https://.'
export const INSECURE_ADDRESS_WARNING = 'A senha será enviada sem criptografia.'

/** Texto do bloco de erro do login (protótipo + divergências 2 a 4 de D11). `address` é o `baseUrl` da tentativa. */
export function loginErrorMessage(error: ChatError, address: string): string {
  switch (error.kind) {
    case 'invalid-credentials':
    // O login nunca devolve `unauthorized` (401 no login é `invalid-credentials`); o case existe só para o switch
    // ser exaustivo. O 401 em uso terá mensagem própria na `sessao-expirada`: não reaproveitar este texto.
    case 'unauthorized':
      return 'Usuário ou senha incorretos.'
    case 'unreachable':
      return `Não foi possível conectar a ${address}. Confira o endereço e se o serviço está no ar.`
    case 'http':
      if (error.status === 0 || (error.status >= 300 && error.status <= 399)) {
        return `O serviço em ${address} respondeu com um redirecionamento, que o app não segue. Confira o endereço (por exemplo, https:// em vez de http://).`
      }
      return `O serviço em ${address} respondeu com erro ${error.status}. Confira o endereço.`
    case 'bad-response':
    case 'rpc':
      return `O serviço em ${address} deu uma resposta inesperada. Confira o endereço.`
  }
}
