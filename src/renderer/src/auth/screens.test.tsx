import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatError } from '../../../shared/api'
import { App } from '../App'
import { SERVICE_URL_KEY } from './saved-service-url'
import { loggedIn, LOGGED_OUT, mockAuth } from './test-auth'

let auth: ReturnType<typeof mockAuth>

beforeEach(() => {
  localStorage.clear()
  auth = mockAuth()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderLogin() {
  render(<App />)
  await screen.findByRole('heading', { name: 'Entrar' })
}

const addressField = () => screen.getByLabelText('Endereço do serviço')
const usernameField = () => screen.getByLabelText('Usuário')
const passwordField = () => screen.getByLabelText('Senha')
const submitButton = () => screen.getByRole('button', { name: 'Entrar' })

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } })
}

function fill(address: string | null, username = 'ana', password = 's3nha') {
  if (address !== null) type(addressField(), address)
  type(usernameField(), username)
  type(passwordField(), password)
}

async function failWith(error: ChatError, address = 'http://localhost:5017') {
  auth.login.mockResolvedValueOnce({ ok: false, error })
  fill(address)
  fireEvent.click(submitButton())
  return screen.findByRole('alert')
}

describe('estrutura da tela de login', () => {
  it('mostra a marca acima do cartão, e nada abaixo dele', async () => {
    await renderLogin()

    const card = screen.getByRole('heading', { name: 'Entrar' }).closest('.mantine-Paper-root')!
    const column = card.parentElement!
    expect(column.children).toHaveLength(2)
    expect(column.children[1]).toBe(card)
    expect(column.children[0]).toHaveTextContent('Buteco Chat')
    expect(column.children[0]!.querySelector('svg')).not.toBeNull()
  })

  it('o cartão usa a superfície (Paper) sobre o fundo da página', async () => {
    await renderLogin()

    const card = screen.getByRole('heading', { name: 'Entrar' }).closest('.mantine-Paper-root')
    expect(card).not.toBeNull()
  })

  it('campos acessíveis', async () => {
    await renderLogin()

    expect(usernameField()).toHaveAttribute('autocomplete', 'username')
    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('sem textos de ajuda: o cartão só tem título, subtítulo, rótulos e botão', async () => {
    await renderLogin()
    type(addressField(), 'https://host')

    const card = screen.getByRole('heading', { name: 'Entrar' }).closest('form')!
    expect(card.textContent).toBe(
      'EntrarUse o mesmo usuário e senha do painel Buteco Agentes.Endereço do serviçoUsuárioSenhaEntrar'
    )
  })

  it('ordem: título, subtítulo, erro, endereço, usuário, senha, botão', async () => {
    await renderLogin()
    const alert = await failWith({ kind: 'invalid-credentials' })

    const sequence = [
      screen.getByRole('heading', { name: 'Entrar' }),
      screen.getByText('Use o mesmo usuário e senha do painel Buteco Agentes.'),
      alert,
      addressField(),
      usernameField(),
      passwordField(),
      submitButton()
    ]
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i - 1]!.compareDocumentPosition(sequence[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })
})

describe('primeiro acesso', () => {
  it('campo de endereço vazio, com placeholder, mono e sem mensagem', async () => {
    await renderLogin()

    expect(addressField()).toHaveValue('')
    expect(addressField()).toHaveAttribute('type', 'url')
    expect(addressField()).toHaveAttribute('placeholder', 'http://localhost:5017')
    expect(screen.queryByText(/Informe um endereço completo/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('não acusa endereço inválido enquanto o usuário digita', async () => {
    await renderLogin()

    type(addressField(), 'h')

    expect(screen.queryByText(/Informe um endereço completo/)).toBeNull()
  })

  it('endereço inválido ao sair do campo: borda, mensagem e Entrar desabilitado; some ao corrigir', async () => {
    await renderLogin()
    fill('localhost:5017')
    fireEvent.blur(addressField())

    expect(screen.getByText('Informe um endereço completo, começando com http:// ou https://.')).toBeVisible()
    expect(addressField()).toHaveAttribute('aria-invalid', 'true')
    expect(submitButton()).toBeDisabled()

    type(addressField(), 'http://localhost:5017')

    expect(screen.queryByText(/Informe um endereço completo/)).toBeNull()
    expect(addressField()).not.toHaveAttribute('aria-invalid', 'true')
    expect(submitButton()).toBeEnabled()
  })

  it('valor salvo inválido vale como primeiro acesso', async () => {
    localStorage.setItem(SERVICE_URL_KEY, 'ftp://host')
    await renderLogin()

    expect(addressField()).toHaveValue('')
  })
})

describe('aviso de HTTP sem criptografia', () => {
  it('aparece para HTTP em rede local, sem impedir o envio', async () => {
    await renderLogin()
    fill('http://192.168.0.10:5017')

    expect(screen.getByText('A senha será enviada sem criptografia.')).toBeVisible()
    expect(addressField()).not.toHaveAttribute('aria-invalid', 'true')
    expect(submitButton()).toBeEnabled()
  })

  it('não aparece em loopback nem em https', async () => {
    await renderLogin()
    type(addressField(), 'http://localhost:5017')
    expect(screen.queryByText('A senha será enviada sem criptografia.')).toBeNull()

    type(addressField(), 'https://servidor.interno')
    expect(screen.queryByText('A senha será enviada sem criptografia.')).toBeNull()
  })

  it('aparece também na linha "Serviço" de um endereço salvo', async () => {
    localStorage.setItem(SERVICE_URL_KEY, 'http://servidor.interno')
    await renderLogin()

    expect(screen.getByText('A senha será enviada sem criptografia.')).toBeVisible()
  })
})

describe('acessos seguintes', () => {
  it('mostra a linha "Serviço" com Alterar, e usuário e senha vazios', async () => {
    localStorage.setItem(SERVICE_URL_KEY, 'https://host/buteco')
    await renderLogin()

    expect(screen.getByText('Serviço')).toBeVisible()
    expect(screen.getByText('https://host/buteco')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Alterar' })).toBeVisible()
    expect(screen.queryByLabelText('Endereço do serviço')).toBeNull()
    expect(usernameField()).toHaveValue('')
    expect(passwordField()).toHaveValue('')
  })

  it('Alterar troca a linha pelo campo preenchido', async () => {
    localStorage.setItem(SERVICE_URL_KEY, 'https://host/buteco')
    await renderLogin()

    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))

    expect(addressField()).toHaveValue('https://host/buteco')
    expect(screen.queryByText('Serviço')).toBeNull()
  })
})

describe('envio e erros', () => {
  it('Entrar desabilitado com usuário ou senha vazios', async () => {
    await renderLogin()
    fill('http://localhost:5017', 'ana', '')
    expect(submitButton()).toBeDisabled()

    fill('http://localhost:5017', '', 's3nha')
    expect(submitButton()).toBeDisabled()
  })

  it('durante o login, o botão carrega e os campos ficam desabilitados', async () => {
    auth.login.mockReturnValueOnce(new Promise(() => {}))
    await renderLogin()
    fill('http://localhost:5017')

    fireEvent.click(submitButton())

    await waitFor(() => expect(submitButton()).toHaveAttribute('data-loading', 'true'))
    expect(addressField()).toBeDisabled()
    expect(usernameField()).toBeDisabled()
    expect(passwordField()).toBeDisabled()
  })

  it('envia o endereço normalizado', async () => {
    await renderLogin()
    fill('  https://host/buteco/ ')

    fireEvent.click(submitButton())

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('https://host/buteco', 'ana', 's3nha'))
  })

  it('senha errada: mensagem, usuário mantido e senha limpa', async () => {
    await renderLogin()

    const alert = await failWith({ kind: 'invalid-credentials' })

    expect(alert).toHaveTextContent('Usuário ou senha incorretos.')
    expect(usernameField()).toHaveValue('ana')
    expect(passwordField()).toHaveValue('')
  })

  it.each<[string, ChatError, string]>([
    [
      'serviço fora do ar',
      { kind: 'unreachable', message: 'net::ERR_CONNECTION_REFUSED' },
      'Não foi possível conectar a http://localhost:5017. Confira o endereço e se o serviço está no ar.'
    ],
    ['erro HTTP', { kind: 'http', status: 404 }, 'O serviço em http://localhost:5017 respondeu com erro 404. Confira o endereço.'],
    [
      'redirecionamento',
      { kind: 'http', status: 0 },
      'O serviço em http://localhost:5017 respondeu com um redirecionamento, que o app não segue. Confira o endereço (por exemplo, https:// em vez de http://).'
    ],
    [
      'resposta inesperada',
      { kind: 'bad-response' },
      'O serviço em http://localhost:5017 deu uma resposta inesperada. Confira o endereço.'
    ]
  ])('%s: mensagem, usuário e senha mantidos', async (_label, error, message) => {
    await renderLogin()

    const alert = await failWith(error)

    expect(alert).toHaveTextContent(message)
    expect(usernameField()).toHaveValue('ana')
    expect(passwordField()).toHaveValue('s3nha')
  })
})

describe('endereço lembrado', () => {
  it('grava o endereço normalizado só depois do sucesso, e nada mais', async () => {
    auth.status.mockResolvedValueOnce(LOGGED_OUT).mockResolvedValue(loggedIn(30, 'https://host/buteco'))
    await renderLogin()
    fill('https://host/buteco/', 'operador-unico', 'senha-unica')

    fireEvent.click(submitButton())
    await screen.findByRole('button', { name: 'Sair' })

    expect(localStorage.getItem(SERVICE_URL_KEY)).toBe('https://host/buteco')
    for (let i = 0; i < localStorage.length; i++) {
      const value = localStorage.getItem(localStorage.key(i)!) ?? ''
      expect(value).not.toContain('operador-unico')
      expect(value).not.toContain('senha-unica')
    }
  })

  it('falha não grava', async () => {
    await renderLogin()

    await failWith({ kind: 'invalid-credentials' }, 'https://host')

    expect(localStorage.getItem(SERVICE_URL_KEY)).toBeNull()
  })

  it('sem armazenamento: primeiro acesso, e o login funciona sem erro', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('armazenamento indisponível')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento indisponível')
    })
    auth.status.mockResolvedValueOnce(LOGGED_OUT).mockResolvedValue(loggedIn())
    await renderLogin()
    expect(addressField()).toHaveValue('')
    fill('http://localhost:5017')

    fireEvent.click(submitButton())

    expect(await screen.findByRole('button', { name: 'Sair' })).toBeVisible()
  })
})

// O rodapé de sessão (usuário, host, minutos, Sair, tempo esgotado) é testado em conversation/conversation.test.tsx.
describe('tela inicial', () => {
  it('recarregar com sessão ativa vai direto à tela de conversas', async () => {
    auth.status.mockResolvedValue(loggedIn())
    render(<App />)

    expect(await screen.findByText('AGENTE')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Entrar' })).toBeNull()
  })

  it('login bem-sucedido leva à tela de conversas', async () => {
    auth.status.mockResolvedValueOnce(LOGGED_OUT).mockResolvedValue(loggedIn())
    await renderLogin()
    fill('http://localhost:5017')

    fireEvent.click(submitButton())

    expect(await screen.findByText('AGENTE')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Entrar' })).toBeNull()
  })

  it('Sair volta aos acessos seguintes, com campos vazios', async () => {
    localStorage.setItem(SERVICE_URL_KEY, 'http://localhost:5017')
    auth.status.mockResolvedValue(loggedIn())
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }))

    await screen.findByRole('heading', { name: 'Entrar' })
    expect(auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Alterar' })).toBeVisible()
    expect(usernameField()).toHaveValue('')
    expect(passwordField()).toHaveValue('')
  })
})

describe('marca', () => {
  it('"Buteco" e "Chat" lado a lado', async () => {
    await renderLogin()

    const brand = screen.getByText('Buteco').parentElement!
    expect(within(brand).getByText('Chat')).toBeVisible()
  })
})
