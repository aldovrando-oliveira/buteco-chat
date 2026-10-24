import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButecoApi } from '../../../shared/api'
import { App } from '../App'
import { loggedIn } from '../auth/test-auth'
import { ANTIGO, ATENDENTE, CONTEXT_ID, mockButeco, sent, task, TASK_ID, TRADUTOR } from './test-chat'
import { useConversation } from './use-conversation'

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
  return screen.queryAllByRole('alert').find((element) => element.textContent?.includes(text))
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

describe('sessão expirada (sessao-expirada)', () => {
  const UNAUTHORIZED = { ok: false as const, error: { kind: 'unauthorized' as const } }
  const POLL_TEXT =
    'A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado.'
  const SEND_TEXT = 'Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez.'
  const IDLE_TEXT = 'Entre de novo para continuar.'
  const POLL_SUBTITLE = 'A conversa e a resposta em andamento continuam onde estavam.'
  const SEND_SUBTITLE = 'A conversa continua onde estava. A mensagem será enviada depois do login.'

  type Login = ButecoApi['auth']['login']
  const renewedLogin: Login = async () => ({
    ok: true,
    value: { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }
  })

  beforeEach(() => {
    api.auth.login.mockImplementation(renewedLogin)
  })

  const banner = () => alertWith('Sua sessão expirou.')
  const dialog = () => screen.getByRole('dialog')
  const passwordField = () => within(dialog()).getByLabelText('Senha')
  const status = () => screen.getByRole('status')

  async function openRelogin() {
    fireEvent.click(within(banner()!).getByRole('button', { name: 'Entrar novamente' }))
    await advance(300)
  }

  async function submitRelogin(password = 's3nha') {
    fireEvent.change(passwordField(), { target: { value: password } })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Entrar' }))
    await flush()
    await flush()
  }

  async function relogin(password = 's3nha') {
    await openRelogin()
    await submitRelogin(password)
    await advance(300)
  }

  /** Avança um tique por vez: dentro de um único act, o React só aplicaria o contador uma vez. */
  async function tick(seconds: number) {
    for (let second = 0; second < seconds; second++) await advance(1000)
  }

  it('401 no GetTask: banner, pílula, rodapé e composer; novo login retoma o mesmo taskId sem chat.send', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await advance(1000)
    const consultas = api.chat.getTask.mock.calls.length

    expect(banner()).toHaveTextContent(POLL_TEXT)
    expect(status()).toHaveTextContent('Aguardando novo login para retomar')
    expect(status()).toHaveTextContent('task 1a2b3c4d · Working')
    expect(status()).not.toHaveTextContent('Processando')
    expect(screen.getByText('Sessão expirada')).toBeInTheDocument()
    expect(screen.queryByText(/Sessão válida por mais/)).toBeNull()
    expect(messageBox()).toBeDisabled()
    expect(messageBox()).toHaveAttribute('placeholder', 'Entre novamente para continuar')
    await advance(10_000)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
    expect(api.auth.logout).not.toHaveBeenCalled()

    await openRelogin()
    expect(within(dialog()).getByText('Entrar novamente')).toBeInTheDocument()
    expect(within(dialog()).getByText(POLL_SUBTITLE)).toBeInTheDocument()
    expect(within(dialog()).getByText('http://localhost:5017')).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Usuário')).toHaveValue('ana')
    expect(within(dialog()).getByLabelText('Usuário')).toHaveAttribute('readonly')
    expect(within(dialog()).queryByRole('button', { name: 'Alterar' })).toBeNull()
    expect(passwordField()).toHaveValue('')
    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password')
    expect(passwordField()).toHaveFocus()
    await submitRelogin('s3nha')
    await advance(300)

    expect(api.auth.login).toHaveBeenCalledWith('http://localhost:5017', 'ana', 's3nha')
    expect(banner()).toBeUndefined()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Sessão válida por mais 30 min')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Processando')
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas + 1)
    expect(api.chat.getTask).toHaveBeenLastCalledWith(ATENDENTE.id, TASK_ID)
    expect(api.chat.send).toHaveBeenCalledOnce()
  })

  it('prazo novo na retomada: o tempo no modal não conta', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(80_000)
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await advance(1000)
    await advance(5 * 60_000)

    await relogin()
    await advance(88_000)
    expect(alertWith('O agente não respondeu a tempo.')).toBeUndefined()
    expect(status()).toHaveTextContent('Processando')
    await advance(3000)
    expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
  })

  it('401 no SendMessage: envio retido e reenvio único com o mesmo texto e contextId', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'olá'))
    await renderScreen()
    await sendMessage('oi')
    await advance(1000)
    api.chat.send.mockResolvedValueOnce(UNAUTHORIZED)

    await sendMessage('tudo bem?')

    expect(banner()).toHaveTextContent(SEND_TEXT)
    expect(status()).toHaveTextContent('Aguardando novo login para enviar')
    expect(status()).not.toHaveTextContent('task')
    await openRelogin()
    expect(within(dialog()).getByText(SEND_SUBTITLE)).toBeInTheDocument()
    await submitRelogin()
    await advance(1000)

    expect(api.chat.send).toHaveBeenCalledTimes(3)
    expect(api.chat.send).toHaveBeenLastCalledWith(ATENDENTE.id, 'tudo bem?', CONTEXT_ID)
    expect(screen.getAllByTestId('user-message').filter((m) => m.textContent?.includes('tudo bem?'))).toHaveLength(1)
  })

  it('um segundo sucesso de login sem nova expiração não reenvia', async () => {
    mockButeco()
    const wrapper = ({ children }: { children: ReactNode }) => <MantineProvider>{children}</MantineProvider>
    const { result } = renderHook(() => useConversation(), { wrapper })
    await flush()
    window.buteco.chat.send = vi.fn<ButecoApi['chat']['send']>(async () => sent()).mockResolvedValueOnce(UNAUTHORIZED)
    act(() => result.current.send('oi'))
    await flush()
    expect(result.current.expired).toBe(true)

    act(() => {
      result.current.renew()
      result.current.renew()
    })
    await flush()

    expect(window.buteco.chat.send).toHaveBeenCalledTimes(2)
  })

  it('401 na recarga da lista: a lista anterior fica, e o novo login recarrega', async () => {
    api.chat.send.mockResolvedValue(sent('TASK_STATE_REJECTED'))
    await renderScreen()
    api.agents.list.mockResolvedValueOnce(UNAUTHORIZED)

    await sendMessage('oi')
    await flush()

    expect(agentSelect()).toHaveValue('Atendente')
    expect(banner()).toHaveTextContent(IDLE_TEXT)
    expect(api.auth.logout).not.toHaveBeenCalled()
    await relogin()
    expect(api.agents.list).toHaveBeenCalledTimes(3)
  })

  it('lista e task guardadas juntas: um login retoma as duas, cada uma uma vez', async () => {
    api.chat.send.mockResolvedValueOnce(sent('TASK_STATE_REJECTED'))
    await renderScreen()
    let answerList!: (result: Awaited<ReturnType<ButecoApi['agents']['list']>>) => void
    api.agents.list.mockImplementationOnce(() => new Promise((resolve) => (answerList = resolve)))
    await sendMessage('oi')
    await sendMessage('de novo')
    await advance(1000)
    const consultas = api.chat.getTask.mock.calls.length

    await act(async () => answerList(UNAUTHORIZED))
    await flush()
    expect(banner()).toHaveTextContent(POLL_TEXT)
    await relogin()
    await advance(1000)

    expect(api.agents.list).toHaveBeenCalledTimes(3)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas + 1)
    expect(api.chat.send).toHaveBeenCalledTimes(2)
  })

  it('401 na primeira carga: só o banner; depois do login, a carga é refeita', async () => {
    api.agents.list.mockResolvedValueOnce(UNAUTHORIZED)
    await renderScreen()

    expect(banner()).toHaveTextContent(IDLE_TEXT)
    expect(screen.queryByText('Carregando agentes…')).toBeNull()
    expect(screen.queryByText('Não foi possível carregar os agentes.')).toBeNull()
    await openRelogin()
    expect(within(dialog()).queryByText(/continua/)).toBeNull()
    let answerList!: (result: Awaited<ReturnType<ButecoApi['agents']['list']>>) => void
    api.agents.list.mockImplementationOnce(() => new Promise((resolve) => (answerList = resolve)))
    await submitRelogin()

    expect(screen.getByText('Carregando agentes…')).toBeInTheDocument()
    await act(async () => answerList({ ok: true, value: [ATENDENTE] }))
    await flush()
    expect(screen.getByText('NOVA CONVERSA COM')).toBeInTheDocument()
  })

  it('contador chegando a zero com a conversa parada: estado expirado sem status() nem logout()', async () => {
    api.auth.status.mockResolvedValue(loggedIn(1))
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'olá'))
    await renderScreen()
    await sendMessage('oi')
    await tick(61)

    expect(banner()).toHaveTextContent(IDLE_TEXT)
    expect(screen.getByText('Sessão expirada')).toBeInTheDocument()
    expect(api.auth.status).toHaveBeenCalledOnce()
    expect(api.auth.logout).not.toHaveBeenCalled()
    await openRelogin()
    expect(within(dialog()).queryByText(/continua/)).toBeNull()
    await submitRelogin()
    await advance(300)
    expect(screen.getByText('Sessão válida por mais 30 min')).toBeInTheDocument()
  })

  it('contador chegando a zero com uma consulta em andamento: descarta a resposta e retoma o mesmo taskId', async () => {
    api.auth.status.mockResolvedValue(loggedIn(1))
    await renderScreen()
    await sendMessage('oi')
    await tick(55)
    let answerTask!: (result: Awaited<ReturnType<ButecoApi['chat']['getTask']>>) => void
    api.chat.getTask.mockImplementationOnce(() => new Promise((resolve) => (answerTask = resolve)))
    await tick(6)
    const consultas = api.chat.getTask.mock.calls.length

    await act(async () => answerTask(task('TASK_STATE_WORKING')))
    await advance(5000)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
    expect(status()).toHaveTextContent('Aguardando novo login para retomar')

    await relogin()
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas + 1)
    expect(api.chat.getTask).toHaveBeenLastCalledWith(ATENDENTE.id, TASK_ID)
  })

  it('contador chegando a zero com um envio em andamento que dá certo: a task espera o login', async () => {
    api.auth.status.mockResolvedValue(loggedIn(1))
    await renderScreen()
    await tick(58)
    let answerSend!: (result: Awaited<ReturnType<ButecoApi['chat']['send']>>) => void
    api.chat.send.mockImplementationOnce(() => new Promise((resolve) => (answerSend = resolve)))
    await sendMessage('oi')
    await tick(3)

    await act(async () => answerSend(sent()))
    await advance(5000)
    expect(api.chat.getTask).not.toHaveBeenCalled()
    expect(status()).toHaveTextContent('Aguardando novo login para retomar')
    expect(status()).toHaveTextContent('task 1a2b3c4d · Submitted')
    expect(banner()).toHaveTextContent(POLL_TEXT)

    await relogin()
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledWith(ATENDENTE.id, TASK_ID)
    expect(api.chat.send).toHaveBeenCalledOnce()
  })

  it('401 no getTask prévio de Reenviar: volta ao prazo esgotado, sem reenvio nem retomada', async () => {
    await renderScreen()
    await sendMessage('oi')
    await advance(90_000)
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)

    fireEvent.click(within(alertWith('O agente não respondeu a tempo.')!).getByRole('button', { name: 'Reenviar' }))
    await flush()

    expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
    expect(banner()).toHaveTextContent(IDLE_TEXT)
    await relogin()
    const consultas = api.chat.getTask.mock.calls.length
    await advance(5000)
    expect(api.chat.send).toHaveBeenCalledOnce()
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
    expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar aguardando' }))
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas + 1)
  })

  describe('época da sessão: 401 de uma chamada iniciada antes do novo login (D7)', () => {
    it('chat.send: não expira de novo; a mensagem vai uma vez, com o token novo, no mesmo contextId', async () => {
      api.auth.status.mockResolvedValue(loggedIn(1))
      await renderScreen()
      await tick(58)
      let answerSend!: (result: Awaited<ReturnType<ButecoApi['chat']['send']>>) => void
      api.chat.send.mockImplementationOnce(() => new Promise((resolve) => (answerSend = resolve)))
      await sendMessage('oi')
      await tick(3)
      expect(banner()).toBeDefined()
      await relogin()

      await act(async () => answerSend(UNAUTHORIZED))
      await flush()

      expect(banner()).toBeUndefined()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(api.chat.send).toHaveBeenCalledTimes(2)
      expect(api.chat.send).toHaveBeenLastCalledWith(ATENDENTE.id, 'oi', null)
      expect(screen.getAllByTestId('user-message')).toHaveLength(1)
      expect(status()).toHaveTextContent('Processando')
      await advance(1000)
      expect(api.chat.getTask).toHaveBeenCalledWith(ATENDENTE.id, TASK_ID)
    })

    it('agents.list: não expira de novo; a lista é carregada de novo', async () => {
      api.auth.status.mockResolvedValue(loggedIn(1))
      await renderScreen()
      await tick(58)
      let answerList!: (result: Awaited<ReturnType<ButecoApi['agents']['list']>>) => void
      api.agents.list.mockImplementationOnce(() => new Promise((resolve) => (answerList = resolve)))
      fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
      await flush()
      await tick(3)
      await relogin()
      const cargas = api.agents.list.mock.calls.length

      await act(async () => answerList(UNAUTHORIZED))
      await flush()

      expect(banner()).toBeUndefined()
      expect(api.agents.list).toHaveBeenCalledTimes(cargas + 1)
      expect(agentSelect()).toHaveValue('Atendente')
    })

    it('getTask prévio de Reenviar: o turno volta ao prazo esgotado, sem expirar', async () => {
      api.auth.status.mockResolvedValue(loggedIn(2))
      await renderScreen()
      await sendMessage('oi')
      await tick(91)
      expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
      let answerTask!: (result: Awaited<ReturnType<ButecoApi['chat']['getTask']>>) => void
      api.chat.getTask.mockImplementationOnce(() => new Promise((resolve) => (answerTask = resolve)))
      fireEvent.click(within(alertWith('O agente não respondeu a tempo.')!).getByRole('button', { name: 'Reenviar' }))
      await flush()
      await tick(30)
      expect(banner()).toBeDefined()
      await relogin()

      await act(async () => answerTask(UNAUTHORIZED))
      await flush()

      expect(banner()).toBeUndefined()
      expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
      expect(api.chat.send).toHaveBeenCalledOnce()
    })

    it('getTask do poller: a resposta antiga é descartada pela geração do stop()', async () => {
      api.auth.status.mockResolvedValue(loggedIn(1))
      await renderScreen()
      await sendMessage('oi')
      await tick(55)
      let answerTask!: (result: Awaited<ReturnType<ButecoApi['chat']['getTask']>>) => void
      api.chat.getTask.mockImplementationOnce(() => new Promise((resolve) => (answerTask = resolve)))
      await tick(6)
      await relogin()

      await act(async () => answerTask(UNAUTHORIZED))
      await flush()
      const consultas = api.chat.getTask.mock.calls.length
      await advance(1000)

      expect(banner()).toBeUndefined()
      expect(status()).toHaveTextContent('Processando')
      expect(api.chat.getTask).toHaveBeenCalledTimes(consultas + 1)
    })
  })

  describe('modal', () => {
    async function expireWithPendingTask() {
      await renderScreen()
      await sendMessage('oi')
      api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
      await advance(1000)
      return api.chat.getTask.mock.calls.length
    }

    it('Cancelar fecha sem login; o banner e Sair continuam; reabrir mostra a senha vazia', async () => {
      await expireWithPendingTask()
      await openRelogin()
      fireEvent.change(passwordField(), { target: { value: 'meio-digitada' } })

      fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
      await advance(300)

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(api.auth.login).not.toHaveBeenCalled()
      expect(banner()).toBeDefined()
      expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
      await openRelogin()
      expect(passwordField()).toHaveValue('')
    })

    it('senha errada: mensagem do login, senha limpa e modal aberto', async () => {
      await expireWithPendingTask()
      api.auth.login.mockResolvedValueOnce({ ok: false, error: { kind: 'invalid-credentials' } })
      await openRelogin()
      await submitRelogin('errada')

      expect(within(dialog()).getByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.')
      expect(passwordField()).toHaveValue('')
      expect(banner()).toBeDefined()
    })

    it.each([
      [
        { kind: 'unreachable', message: 'net::ERR_CONNECTION_REFUSED' } as const,
        'Não foi possível conectar a http://localhost:5017. Confira o endereço e se o serviço está no ar.'
      ],
      [{ kind: 'http', status: 500 } as const, 'O serviço em http://localhost:5017 respondeu com erro 500. Confira o endereço.'],
      [{ kind: 'bad-response' } as const, 'O serviço em http://localhost:5017 deu uma resposta inesperada. Confira o endereço.']
    ])('%o: mensagem do login, senha mantida e a retomada guardada', async (error, message) => {
      const consultas = await expireWithPendingTask()
      api.auth.login.mockResolvedValueOnce({ ok: false, error })
      await openRelogin()
      await submitRelogin('s3nha')

      expect(within(dialog()).getByRole('alert')).toHaveTextContent(message)
      expect(passwordField()).toHaveValue('s3nha')
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Entrar' }))
      await flush()
      await flush()
      await advance(1000)
      expect(api.chat.getTask).toHaveBeenCalledTimes(consultas + 1)
      expect(api.chat.getTask).toHaveBeenLastCalledWith(ATENDENTE.id, TASK_ID)
    })

    it('durante o login, Esc e Cancelar não fecham; um segundo envio não chama login de novo', async () => {
      await expireWithPendingTask()
      api.auth.login.mockImplementationOnce(() => new Promise(() => {}))
      await openRelogin()
      fireEvent.change(passwordField(), { target: { value: 's3nha' } })
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Entrar' }))
      await flush()

      fireEvent.submit(passwordField().closest('form')!)
      fireEvent.keyDown(dialog(), { key: 'Escape' })
      await advance(300)

      expect(api.auth.login).toHaveBeenCalledOnce()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(within(dialog()).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    })
  })

  it('ações na sessão expirada: Reenviar, Continuar aguardando, seletor e Nova conversa bloqueados; Copiar livre', async () => {
    api.auth.status.mockResolvedValue(loggedIn(2))
    await renderScreen()
    await sendMessage('oi')
    await tick(121)

    const timeout = alertWith('O agente não respondeu a tempo.')!
    expect(within(timeout).getByRole('button', { name: 'Reenviar' })).toBeDisabled()
    expect(within(timeout).getByRole('button', { name: 'Continuar aguardando' })).toBeDisabled()
    expect(agentSelect()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))
    await flush()
    expect(api.clipboard.writeText).toHaveBeenCalledWith(CONTEXT_ID)
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('Sair na sessão expirada: logout, login vazio e nada depois', async () => {
    await renderScreen()
    await sendMessage('oi')
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await advance(1000)
    const consultas = api.chat.getTask.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await flush()
    await advance(5000)

    expect(api.auth.logout).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByLabelText('Usuário')).toHaveValue('')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
    expect(api.chat.send).toHaveBeenCalledOnce()
  })
})
