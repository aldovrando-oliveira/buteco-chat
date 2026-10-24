import { notifications } from '@mantine/notifications'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App, SESSION_ENDED_MESSAGE } from '../App'
import { loggedIn, LOGGED_OUT } from '../auth/test-auth'
import { ANTIGO, ATENDENTE, CONTEXT_ID, mockButeco, sent, task, TRADUTOR } from './test-chat'

let api: ReturnType<typeof mockButeco>

/** Timers falsos puros: o `waitFor` do Testing Library não anda sozinho, então todo avanço é explícito. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const flush = () => advance(0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 24, 15, 0, 0))
  localStorage.clear()
  api = mockButeco()
})

afterEach(() => {
  // A fila de notificações do Mantine é global: sem limpar, uma notificação passa para o teste seguinte.
  act(() => notifications.clean())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function renderScreen() {
  render(<App />)
  await flush()
  await flush()
}

const messageBox = () => screen.getByRole('textbox', { name: 'Mensagem' })
const sendButton = () => screen.getByRole('button', { name: 'Enviar mensagem' })
const agentSelect = () => screen.getByRole('combobox', { name: 'Agente' })

function typeMessage(text: string) {
  fireEvent.change(messageBox(), { target: { value: text } })
}

async function sendMessage(text: string) {
  typeMessage(text)
  fireEvent.keyDown(messageBox(), { key: 'Enter' })
  await flush()
}

async function chooseAgent(name: string) {
  fireEvent.click(agentSelect())
  await advance(300)
  fireEvent.click(screen.getByRole('option', { name, hidden: true }))
  await advance(300)
}

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((element) => element.textContent?.includes(text))
}

describe('barra lateral', () => {
  it('mostra, em ordem, marca, AGENTE, seletor, Nova conversa e rodapé', async () => {
    await renderScreen()

    const sidebar = document.querySelector('aside.buteco-sidebar') as HTMLElement
    const order = [
      within(sidebar).getByText('Buteco'),
      within(sidebar).getByText('Chat'),
      within(sidebar).getByText('AGENTE'),
      agentSelect(),
      within(sidebar).getByRole('button', { name: 'Nova conversa' }),
      within(sidebar).getByTestId('history-placeholder'),
      within(sidebar).getByRole('button', { name: 'Sair' })
    ]
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('largura, direção e área reservada vêm de classes, não de estilo inline (D20)', async () => {
    await renderScreen()

    const root = document.querySelector('.buteco-conversation') as HTMLElement
    const sidebar = root.querySelector('.buteco-sidebar') as HTMLElement
    expect(root.getAttribute('style')).toBeNull()
    expect(sidebar.getAttribute('style')).toBeNull()
    expect(screen.getByTestId('history-placeholder')).toHaveClass('buteco-sidebar-history')
    expect(screen.getByTestId('history-placeholder').getAttribute('style')).toBeNull()
  })

  it('seletor começa no primeiro ativo e oferece o inativo desabilitado', async () => {
    api.agents.list.mockResolvedValue({ ok: true, value: [ANTIGO, ATENDENTE, TRADUTOR] })
    await renderScreen()

    expect(agentSelect()).toHaveValue('Atendente')
    fireEvent.click(agentSelect())
    await advance(300)
    const inactive = screen.getByRole('option', { name: 'Antigo (inativo)', hidden: true })
    expect(inactive).toHaveAttribute('data-combobox-disabled')
  })

  it('rodapé com iniciais, usuário, host e minutos restantes', async () => {
    await renderScreen()

    const footer = screen.getByRole('button', { name: 'Sair' }).parentElement!
    expect(within(footer).getByText('AN')).toBeInTheDocument()
    expect(within(footer).getByText('ana')).toBeInTheDocument()
    expect(within(footer).getByText('@ localhost:5017')).toBeInTheDocument()
    expect(within(footer).getByText('Sessão válida por mais 30 min')).toBeInTheDocument()
  })

  it('Sair para o polling, chama logout e volta ao login', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)
    const consultas = api.chat.getTask.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await flush()
    await advance(5000)

    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
    expect(screen.queryByText(SESSION_ENDED_MESSAGE)).toBeNull()
  })

  it('tempo esgotado: consulta o main e volta ao login', async () => {
    api.auth.status.mockResolvedValueOnce(loggedIn(1)).mockResolvedValue(LOGGED_OUT)
    await renderScreen()

    // Um tique por vez: dentro de um único act o React só aplica o estado no fim, e o contador andaria uma vez só.
    for (let second = 0; second <= 60; second++) await advance(1000)

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
})

describe('carregamento da lista de agentes', () => {
  it('mostra "Carregando agentes…" até a lista chegar', async () => {
    api.agents.list.mockReturnValue(new Promise(() => {}))
    await renderScreen()

    expect(screen.getByText('Carregando agentes…')).toBeInTheDocument()
    expect(messageBox()).toBeDisabled()
  })

  it('falha na primeira carga: bloco com Tentar de novo', async () => {
    api.agents.list.mockResolvedValueOnce({ ok: false, error: { kind: 'unreachable', message: 'net::ERR_FAILED' } })
    await renderScreen()

    const alert = alertWith('Não foi possível carregar os agentes.')!
    expect(messageBox()).toBeDisabled()
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    await flush()

    expect(api.agents.list).toHaveBeenCalledTimes(2)
    expect(screen.getByText('NOVA CONVERSA COM')).toBeInTheDocument()
  })

  it('lista vazia', async () => {
    api.agents.list.mockResolvedValue({ ok: true, value: [] })
    await renderScreen()

    expect(screen.getByText('Nenhum agente cadastrado na plataforma.')).toBeInTheDocument()
    expect(messageBox()).toBeDisabled()
  })

  it('só inativos: envio bloqueado', async () => {
    api.agents.list.mockResolvedValue({ ok: true, value: [ANTIGO] })
    await renderScreen()

    expect(screen.getByText('Nenhum agente ativo no momento.')).toBeInTheDocument()
    expect(messageBox()).toBeDisabled()
    expect(sendButton()).toBeDisabled()
  })

  it('recarga depois de REJECTED com unreachable mantém a lista em silêncio', async () => {
    api.chat.send.mockResolvedValue(sent('TASK_STATE_REJECTED'))
    await renderScreen()
    api.agents.list.mockResolvedValueOnce({ ok: false, error: { kind: 'unreachable', message: 'net::ERR_FAILED' } })

    await sendMessage('oi')
    await flush()

    expect(api.agents.list).toHaveBeenCalledTimes(2)
    expect(agentSelect()).toHaveValue('Atendente')
    expect(screen.getAllByRole('alert')).toHaveLength(1) // só o bloco da rejeitada
    expect(screen.queryByText('Não foi possível carregar os agentes.')).toBeNull()
  })

  it('recarga depois de REJECTED com unauthorized encerra a sessão', async () => {
    api.chat.send.mockResolvedValue(sent('TASK_STATE_REJECTED'))
    await renderScreen()
    api.agents.list.mockResolvedValueOnce({ ok: false, error: { kind: 'unauthorized' } })

    await sendMessage('oi')
    await flush()
    await advance(500)

    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument()
  })
})

describe('conversa vazia e cabeçalho', () => {
  it('cartão do agente com descrição, skills e a nota do contextId', async () => {
    await renderScreen()

    expect(screen.getByText('NOVA CONVERSA COM')).toBeInTheDocument()
    const name = screen.getAllByText('Atendente').find((element) => element.tagName === 'P')!
    expect(name.style.fontSize).toBe('calc(1.0625rem * var(--mantine-scale))')
    expect(screen.getByText('Responde dúvidas')).toBeInTheDocument()
    expect(screen.getByText('Resumo')).toBeInTheDocument()
    expect(screen.getByText('Tradução')).toBeInTheDocument()
    expect(screen.getByText('O contextId desta conversa é atribuído no primeiro envio.')).toBeInTheDocument()
  })

  it('antes do primeiro envio: "Nova conversa", aguardando e sem Copiar', async () => {
    await renderScreen()

    expect(screen.getByRole('heading', { name: 'Nova conversa' })).toBeInTheDocument()
    expect(screen.getByText('— aguardando o primeiro envio')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
  })

  it('título com os 40 primeiros caracteres da primeira mensagem', async () => {
    await renderScreen()
    const text = `${'a'.repeat(20)}\n${'b'.repeat(39)}`

    await sendMessage(text)

    expect(screen.getByRole('heading', { name: `${'a'.repeat(20)} ${'b'.repeat(19)}…` })).toBeInTheDocument()
  })

  it('contextId abreviado; Copiar envia o valor completo e mostra "Copiado" por 1,5 s', async () => {
    await renderScreen()
    await sendMessage('oi')

    expect(screen.getByText('3a7d9f10…4e5f')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await flush()

    expect(api.clipboard.writeText).toHaveBeenCalledWith(CONTEXT_ID)
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument()
    await advance(1499)
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument()
    await advance(1)
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument()
  })

  it('selo do agente e selo Ativo', async () => {
    await renderScreen()

    const header = screen.getByRole('banner')
    expect(within(header).getByText('Atendente')).toBeInTheDocument()
    const badge = within(header).getByText('Ativo').closest('.mantine-Badge-root') as HTMLElement
    expect(badge.style.color).toBe('var(--buteco-color-success-text)')
  })
})

describe('envio e resposta', () => {
  it('mostra o balão e o pendente com o estado real', async () => {
    await renderScreen()

    await sendMessage('linha 1\nlinha 2')

    expect(screen.getByTestId('user-message')).toHaveTextContent('linha 1 linha 2')
    expect(screen.getByTestId('user-message').textContent).toBe('linha 1\nlinha 2')
    const bubble = screen.getByTestId('user-message').style
    expect(bubble.background).toBe('var(--mantine-color-butecoBlue-light)')
    expect(bubble.borderRadius).toBe('11px 11px 4px 11px')
    expect(bubble.whiteSpace).toBe('pre-wrap')
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Processando')
    expect(screen.getByRole('status')).toHaveTextContent('task 1a2b3c4d · Submitted')

    await advance(1000)
    expect(screen.getByRole('status')).toHaveTextContent('task 1a2b3c4d · Working')
    expect(api.chat.send).toHaveBeenCalledWith(ATENDENTE.id, 'linha 1\nlinha 2', null)
  })

  it('COMPLETED: Markdown e a linha de metadados com a duração do servidor', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'olá **mundo**', '2026-10-24T18:24:03.240Z'))
    await renderScreen()

    await sendMessage('oi')
    await advance(1000)

    const reply = screen.getByTestId('agent-reply')
    expect(within(reply).getByText('mundo').tagName).toBe('STRONG')
    expect(within(reply).getByText('Atendente')).toBeInTheDocument()
    expect(within(reply).getByText('task 1a2b3c4d · Completed · 3,2 s')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('duração pelo relógio local quando o servidor não informa o horário', async () => {
    api.chat.getTask
      .mockResolvedValueOnce(task('TASK_STATE_WORKING'))
      .mockResolvedValueOnce(task('TASK_STATE_WORKING'))
      .mockResolvedValueOnce(task('TASK_STATE_WORKING'))
      .mockResolvedValue(task('TASK_STATE_COMPLETED', 'oi', null))
    await renderScreen()

    await sendMessage('oi')
    await advance(4000)

    expect(screen.getByText('task 1a2b3c4d · Completed · 4,0 s')).toBeInTheDocument()
  })

  it('COMPLETED sem texto: "O agente não devolveu texto."', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', ''))
    await renderScreen()

    await sendMessage('oi')
    await advance(1000)

    expect(screen.getByText('O agente não devolveu texto.')).toBeInTheDocument()
  })

  it('a segunda mensagem vai com o contextId da primeira, e o separador "Hoje" aparece uma vez', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()

    await sendMessage('meu nome é Ana')
    await advance(1000)
    await sendMessage('qual é o meu nome?')

    expect(api.chat.send.mock.calls).toEqual([
      [ATENDENTE.id, 'meu nome é Ana', null],
      [ATENDENTE.id, 'qual é o meu nome?', CONTEXT_ID]
    ])
    expect(screen.getAllByText('Hoje')).toHaveLength(1)
  })
})

describe('estados da task', () => {
  it('FAILED + Reenviar no mesmo contextId, sem segundo balão', async () => {
    api.chat.getTask.mockResolvedValueOnce(task('TASK_STATE_FAILED'))
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)

    const alert = alertWith('O agente não conseguiu responder.')!
    expect(alert).toHaveTextContent('A plataforma não informa o motivo. Você pode reenviar a mensagem.')
    expect(alert).toHaveTextContent('task 1a2b3c4d · Failed')
    fireEvent.click(within(alert).getByRole('button', { name: 'Reenviar' }))
    await flush()

    expect(api.chat.send).toHaveBeenLastCalledWith(ATENDENTE.id, 'oi', CONTEXT_ID)
    expect(screen.getAllByTestId('user-message')).toHaveLength(1)
    expect(screen.queryByText('O agente não conseguiu responder.')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('REJECTED no envio: sem Reenviar, sem consulta, lista recarregada; agente inativo bloqueia o composer', async () => {
    api.chat.send.mockResolvedValue(sent('TASK_STATE_REJECTED'))
    await renderScreen()
    api.agents.list.mockResolvedValue({ ok: true, value: [{ ...ATENDENTE, isActive: false }, TRADUTOR] })

    await sendMessage('oi')
    await advance(2000)

    const alert = alertWith('O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado.')!
    expect(alert).toHaveTextContent('task 1a2b3c4d · Rejected')
    expect(within(alert).queryByRole('button')).toBeNull()
    expect(api.chat.getTask).not.toHaveBeenCalled()
    expect(api.agents.list).toHaveBeenCalledTimes(2)
    expect(within(screen.getByRole('banner')).getByText('Inativo')).toBeInTheDocument()
    expect(messageBox()).toBeDisabled()
    expect(messageBox()).toHaveAttribute(
      'placeholder',
      'Atendente está inativo. Escolha outro agente ou comece uma nova conversa.'
    )
  })

  it('REJECTED no polling também recarrega a lista', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_REJECTED'))
    await renderScreen()

    await sendMessage('oi')
    await advance(1000)

    expect(alertWith('O agente não aceitou a mensagem')).toBeDefined()
    expect(api.agents.list).toHaveBeenCalledTimes(2)
  })

  it('prazo esgotado: composer bloqueado; Continuar aguardando retoma a mesma task', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(90_000)

    const alert = alertWith('O agente não respondeu a tempo.')!
    expect(alert).toHaveTextContent('Se a primeira tentativa terminar depois, o agente pode ver a pergunta duas vezes.')
    expect(alert).toHaveTextContent('task 1a2b3c4d · Working')
    expect(messageBox()).toBeDisabled()
    expect(messageBox()).toHaveAttribute('placeholder', 'Aguardando a resposta do agente…')

    fireEvent.click(within(alert).getByRole('button', { name: 'Continuar aguardando' }))
    await flush()
    expect(screen.getByRole('status')).toBeInTheDocument()
    const consultas = api.chat.getTask.mock.calls.length
    await advance(89_000)
    expect(api.chat.getTask.mock.calls.length).toBeGreaterThan(consultas)
    expect(api.chat.getTask).toHaveBeenLastCalledWith(ATENDENTE.id, '1a2b3c4d-0000-4000-8000-00000000000a')
    expect(screen.queryByText('O agente não respondeu a tempo.')).toBeNull()

    await advance(1000)
    expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
  })

  it('Reenviar depois do prazo com a original concluída mostra a resposta e não reenvia', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(90_000)
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'resposta tardia'))

    fireEvent.click(within(alertWith('O agente não respondeu a tempo.')!).getByRole('button', { name: 'Reenviar' }))
    await flush()

    expect(screen.getByText('resposta tardia')).toBeInTheDocument()
    expect(api.chat.send).toHaveBeenCalledOnce()
  })

  it('Reenviar depois do prazo com a original pendente reenvia no mesmo contextId', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(90_000)

    fireEvent.click(within(alertWith('O agente não respondeu a tempo.')!).getByRole('button', { name: 'Reenviar' }))
    await flush()

    expect(api.chat.send).toHaveBeenCalledTimes(2)
    expect(api.chat.send).toHaveBeenLastCalledWith(ATENDENTE.id, 'oi', CONTEXT_ID)
  })

  it('Reenviar depois do prazo com a consulta prévia em unauthorized encerra a sessão sem reenviar', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(90_000)
    api.chat.getTask.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })

    fireEvent.click(within(alertWith('O agente não respondeu a tempo.')!).getByRole('button', { name: 'Reenviar' }))
    await flush()
    await advance(500)

    expect(api.chat.send).toHaveBeenCalledOnce()
    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument()
  })

  it('falha ambígua no envio: não afirma que nada foi enviado', async () => {
    api.chat.send.mockResolvedValueOnce({ ok: false, error: { kind: 'unreachable', message: 'timeout' } })
    await renderScreen()

    await sendMessage('oi')

    const alert = alertWith('Não foi possível confirmar o envio da mensagem.')!
    expect(alert).toHaveTextContent('Confira a conexão com o serviço e tente de novo.')
    expect(alert.textContent).not.toMatch(/não foi enviad/i)
    fireEvent.click(within(alert).getByRole('button', { name: 'Reenviar' }))
    await flush()
    expect(api.chat.send).toHaveBeenLastCalledWith(ATENDENTE.id, 'oi', null)
  })

  it('rpc no envio: "A plataforma recusou a mensagem." com a message e o code', async () => {
    api.chat.send.mockResolvedValueOnce({ ok: false, error: { kind: 'rpc', code: -32600, message: 'Requisição inválida.' } })
    await renderScreen()

    await sendMessage('oi')

    const alert = alertWith('A plataforma recusou a mensagem.')!
    expect(alert).toHaveTextContent('Requisição inválida.')
    expect(alert).toHaveTextContent('erro -32600')
    expect(within(alert).getByRole('button', { name: 'Reenviar' })).toBeInTheDocument()
  })

  it('falha ao acompanhar: rpc -32001 no polling', async () => {
    api.chat.getTask.mockResolvedValue({ ok: false, error: { kind: 'rpc', code: -32001, message: 'Task não encontrada.' } })
    await renderScreen()

    await sendMessage('oi')
    await advance(5000)

    const alert = alertWith('Não foi possível acompanhar a resposta do agente.')!
    expect(alert).toHaveTextContent('task 1a2b3c4d')
    expect(within(alert).getByRole('button', { name: 'Reenviar' })).toBeInTheDocument()
    expect(api.chat.getTask).toHaveBeenCalledOnce()
  })
})

describe('composer', () => {
  it('Shift+Enter não envia; Enter envia o texto como foi digitado e limpa o campo', async () => {
    await renderScreen()
    typeMessage('oi\ntudo bem?')

    fireEvent.keyDown(messageBox(), { key: 'Enter', shiftKey: true })
    await flush()
    expect(api.chat.send).not.toHaveBeenCalled()

    fireEvent.keyDown(messageBox(), { key: 'Enter' })
    await flush()
    expect(api.chat.send).toHaveBeenCalledWith(ATENDENTE.id, 'oi\ntudo bem?', null)
    expect(messageBox()).toHaveValue('')
  })

  it('Enter durante composição de IME não envia', async () => {
    await renderScreen()
    typeMessage('かな')

    fireEvent.keyDown(messageBox(), { key: 'Enter', isComposing: true })
    await flush()

    expect(api.chat.send).not.toHaveBeenCalled()
  })

  it('placeholder com o agente, dica e envio desabilitado com texto vazio ou só de espaços', async () => {
    await renderScreen()

    expect(messageBox()).toHaveAttribute('placeholder', 'Mensagem para Atendente')
    expect(screen.getByText('Enter envia · Shift+Enter quebra a linha')).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
    typeMessage('  \n ')
    expect(sendButton()).toBeDisabled()
    fireEvent.keyDown(messageBox(), { key: 'Enter' })
    await flush()
    expect(api.chat.send).not.toHaveBeenCalled()
  })

  it('bloqueado durante a espera', async () => {
    await renderScreen()
    await sendMessage('oi')

    expect(messageBox()).toHaveAttribute('placeholder', 'Aguardando a resposta do agente…')
    expect(messageBox()).toBeDisabled()
    expect(sendButton()).toBeDisabled()
    fireEvent.keyDown(messageBox(), { key: 'Enter' })
    await flush()
    expect(api.chat.send).toHaveBeenCalledOnce()
  })

  it('foco volta ao textarea quando o bloqueio termina, se estava nele', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    messageBox().focus()

    await sendMessage('oi')
    // O jsdom não tira o foco de um elemento desabilitado (o navegador tira); o espião prova que o foco é devolvido.
    const focus = vi.spyOn(messageBox(), 'focus')
    await advance(1000)

    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(focus).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(messageBox())
  })

  it('foco volta também depois de uma falha', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_FAILED'))
    await renderScreen()
    messageBox().focus()

    await sendMessage('oi')
    const focus = vi.spyOn(messageBox(), 'focus')
    await advance(1000)

    expect(alertWith('O agente não conseguiu responder.')).toBeDefined()
    expect(focus).toHaveBeenCalledOnce()
  })

  it('foco não volta se outro elemento recebeu foco durante a espera', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    messageBox().focus()

    await sendMessage('oi')
    const focus = vi.spyOn(messageBox(), 'focus')
    const other = screen.getByRole('button', { name: 'Nova conversa' })
    other.focus()
    await advance(1000)

    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(focus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(other)
  })

  it('foco não vai ao textarea se não estava nele quando o envio começou', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    const other = screen.getByRole('button', { name: 'Nova conversa' })
    other.focus()

    await sendMessage('oi')
    const focus = vi.spyOn(messageBox(), 'focus')
    await advance(1000)

    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(focus).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(messageBox())
  })

  it('contador a partir de 14 400 caracteres', async () => {
    await renderScreen()

    typeMessage('x'.repeat(14_399))
    expect(screen.queryByText(/\/ 16\.000/)).toBeNull()
    typeMessage('x'.repeat(14_400))
    expect(screen.getByText('14.400 / 16.000')).toBeInTheDocument()
  })

  it('16 001 caracteres: sem corte, mensagem de limite e envio desabilitado', async () => {
    await renderScreen()

    typeMessage('x'.repeat(16_001))

    expect((messageBox() as HTMLTextAreaElement).value).toHaveLength(16_001)
    expect(screen.getByText('16.001 / 16.000')).toBeInTheDocument()
    expect(screen.getByText('A mensagem passa do limite de 16.000 caracteres.')).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
  })
})

describe('Nova conversa e troca de agente', () => {
  it('conversa vazia: troca e Nova conversa sem modal', async () => {
    await renderScreen()

    await chooseAgent('Tradutor')
    expect(screen.queryByText(/descarta a atual/)).toBeNull()
    expect(agentSelect()).toHaveValue('Tradutor')
    expect(screen.getByText('NOVA CONVERSA COM').parentElement).toHaveTextContent('Tradutor')

    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await flush()
    expect(screen.queryByText(/descarta a atual/)).toBeNull()
    expect(api.agents.list).toHaveBeenCalledTimes(2)
  })

  it('com mensagens, a troca pede confirmação; Cancelar mantém a conversa e o seletor', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)

    await chooseAgent('Tradutor')
    expect(screen.getByText('Trocar de agente começa uma nova conversa e descarta a atual.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await advance(300)

    expect(agentSelect()).toHaveValue('Atendente')
    expect(screen.getByTestId('user-message')).toBeInTheDocument()
  })

  it('confirmar a troca mostra a conversa vazia do novo agente', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)

    await chooseAgent('Tradutor')
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de agente' }))
    await advance(300)

    expect(agentSelect()).toHaveValue('Tradutor')
    expect(screen.queryByTestId('user-message')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Nova conversa' })).toBeInTheDocument()
  })

  it('Nova conversa com resposta pendente: avisa, para o polling e a próxima vai sem contextId', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)

    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await advance(300)
    expect(
      screen.getByText('Começar uma nova conversa descarta a atual. A resposta pendente também será descartada.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Começar nova conversa' }))
    await advance(300)
    const consultas = api.chat.getTask.mock.calls.length
    await advance(5000)

    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
    expect(screen.getByText('NOVA CONVERSA COM')).toBeInTheDocument()
    await sendMessage('de novo')
    expect(api.chat.send).toHaveBeenLastCalledWith(ATENDENTE.id, 'de novo', null)
  })
})

describe('sessão terminada', () => {
  it('unauthorized no polling: logout, login e notificação, sem novas consultas', async () => {
    api.chat.getTask.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })
    await renderScreen()

    await sendMessage('oi')
    await advance(1000)
    await advance(500)

    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument()
    await advance(5000)
    expect(api.chat.getTask).toHaveBeenCalledOnce()
  })

  it('unauthorized na lista de agentes: mesmo caminho', async () => {
    api.agents.list.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })
    await renderScreen()
    await advance(500)

    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument()
  })

  it('unauthorized no envio: mesmo caminho', async () => {
    api.chat.send.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } })
    await renderScreen()

    await sendMessage('oi')
    await advance(500)

    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument()
  })
})
