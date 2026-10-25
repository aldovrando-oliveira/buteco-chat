import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSummary, ButecoApi, Result } from '../../../shared/api'
import { App } from '../App'
import { loggedIn } from '../auth/test-auth'
import type { Attempt, Conversation } from '../conversation/model'
import { ANTIGO, ATENDENTE, CONTEXT_ID, mockButeco, sent, task, TASK_ID, TRADUTOR } from '../conversation/test-chat'
import { SESSIONS_PREFIX } from './storage'

/** Testes do histórico na tela de conversas (historico-conversas). Timers falsos: todo avanço é explícito. */

const BASE = 'http://localhost:5017'
const KEY = `${SESSIONS_PREFIX}${BASE}`
const OTHER_TASK = '9f8e7d6c-0000-4000-8000-00000000000b'
const OTHER_CONTEXT = '7c6b5a49-1b2c-4d5e-8f90-0a1b2c3d4e5f'
const UNAUTHORIZED = { ok: false as const, error: { kind: 'unauthorized' as const } }
const SUMIDO: AgentSummary = { id: 'dddddddd-0000-4000-8000-000000000004', name: 'Sumido', description: null, isActive: true, skills: [] }

let api: ReturnType<typeof mockButeco>

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const flush = () => advance(0)
// Sábado, 24/10/2026, 15:00 (o mesmo relógio dos outros testes da tela).
const at = (month: number, day: number, hour = 12, minute = 0, year = 2026) =>
  new Date(year, month - 1, day, hour, minute).getTime()

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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const completed = (at: number, taskId = TASK_ID): Attempt => ({
  kind: 'completed',
  taskId,
  text: 'resposta',
  receivedAt: at,
  durationSeconds: 1
})
const pending = (taskId = TASK_ID, submittedAt: string | null = '2026-10-24T18:24:00.000Z'): Attempt => ({
  kind: 'pending',
  taskId,
  state: 'TASK_STATE_WORKING',
  submittedAt,
  startedAtLocal: at(10, 24, 14),
  resumed: false
})

function stored(
  id: string,
  title: string,
  lastActivityAt: number,
  attempt: Attempt = completed(lastActivityAt),
  agent: AgentSummary = ATENDENTE
): Conversation {
  return {
    id,
    agent,
    contextId: CONTEXT_ID,
    title,
    createdAt: lastActivityAt,
    lastActivityAt,
    turns: [{ id: Number(id.replace(/\D/g, '')) || 1, text: title, sentAt: lastActivityAt, attempt }]
  }
}

function seed(...conversations: Conversation[]) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, conversations }))
}

function savedConversations(key = KEY): Conversation[] {
  const raw = localStorage.getItem(key)
  return raw === null ? [] : (JSON.parse(raw) as { conversations: Conversation[] }).conversations
}

async function renderScreen() {
  const result = render(<App />)
  await flush()
  await flush()
  return result
}

/** Fecha e abre o app de novo, com o mesmo `localStorage`. */
async function reopen(view: ReturnType<typeof render>) {
  view.unmount()
  return renderScreen()
}

const list = () => screen.getByRole('navigation', { name: 'Conversas' })
const itemButtons = () =>
  within(list())
    .queryAllByRole('button')
    .filter((button) => button.classList.contains('buteco-history-item-button'))
const itemTitles = () => itemButtons().map((button) => button.firstElementChild!.textContent)
/** O botão do item pelo título exibido (string exata) ou pelo nome acessível (RegExp). */
function item(title: string | RegExp): HTMLElement {
  if (title instanceof RegExp) return within(list()).getByRole('button', { name: title })
  const found = itemButtons().find((button) => button.firstElementChild!.textContent === title)
  if (!found) throw new Error(`Item "${title}" não está na lista: ${JSON.stringify(itemTitles())}`)
  return found
}
const main = () => screen.getByRole('main')
const messageBox = () => screen.getByRole('textbox', { name: 'Mensagem' })
const agentSelect = () => screen.getByRole('combobox', { name: 'Agente' })
const alertWith = (text: string) => screen.queryAllByRole('alert').find((el) => el.textContent?.includes(text))

async function sendMessage(text: string) {
  fireEvent.change(messageBox(), { target: { value: text } })
  fireEvent.keyDown(messageBox(), { key: 'Enter' })
  await flush()
}

async function chooseAgent(name: string) {
  fireEvent.click(agentSelect())
  await advance(300)
  fireEvent.click(screen.getByRole('option', { name, hidden: true }))
  await advance(300)
}

async function select(title: string | RegExp) {
  fireEvent.click(item(title))
  await flush()
}

async function clickNewConversation() {
  fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
  await flush()
}

describe('persistência', () => {
  it('envio e resposta gravam a conversa', async () => {
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'Oi! Como posso ajudar?'))
    await renderScreen()
    await sendMessage('Olá')
    await advance(1000)

    const data = JSON.parse(localStorage.getItem(KEY)!) as { version: number; conversations: Conversation[] }
    expect(data.version).toBe(1)
    expect(data.conversations).toHaveLength(1)
    const [conversation] = data.conversations
    expect(conversation!.agent).toEqual(ATENDENTE)
    expect(conversation!.contextId).toBe(CONTEXT_ID)
    expect(conversation!.title).toBe('Olá')
    expect(conversation!.turns).toEqual([
      expect.objectContaining({
        text: 'Olá',
        attempt: expect.objectContaining({ kind: 'completed', taskId: TASK_ID, text: 'Oi! Como posso ajudar?' })
      })
    ])
  })

  it('o rascunho aparece na lista e não é gravado', async () => {
    await renderScreen()

    expect(item(/^Nova conversa/)).toHaveAttribute('aria-current', 'true')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('consultas repetidas em WORKING gravam uma vez', async () => {
    await renderScreen()
    await sendMessage('oi')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await advance(1000)
    const afterWorking = setItem.mock.calls.filter(([key]) => key === KEY).length
    await advance(5000)

    expect(afterWorking).toBe(1)
    expect(setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1)
  })

  it('armazenamento que lança: o app funciona com as conversas em memória', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('indisponível')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('indisponível')
    })
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'tudo certo'))
    await renderScreen()

    expect(screen.getByText('NOVA CONVERSA COM')).toBeInTheDocument()
    await sendMessage('oi')
    await advance(1000)
    expect(screen.getByText('tudo certo')).toBeInTheDocument()
  })

  it('a senha do novo login não vai para o armazenamento', async () => {
    api.auth.login.mockResolvedValue({ ok: true, value: { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } })
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    await sendMessage('oi')
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await advance(1000)
    fireEvent.click(within(alertWith('Sua sessão expirou.')!).getByRole('button', { name: 'Entrar novamente' }))
    await advance(300)
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Senha'), { target: { value: 's3nh@' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }))
    await flush()
    await flush()
    await advance(1000)
    await sendMessage('de novo')
    await advance(1000)

    expect(api.auth.login).toHaveBeenCalledWith(BASE, 'ana', 's3nh@')
    for (let i = 0; i < localStorage.length; i++) {
      const value = localStorage.getItem(localStorage.key(i)!)!
      expect(value).not.toContain('s3nh@')
    }
    for (const conversation of savedConversations()) {
      expect(conversation).not.toHaveProperty('token')
      expect(conversation).not.toHaveProperty('password')
      expect(conversation).not.toHaveProperty('expiresAt')
    }
  })
})

describe('reabrir', () => {
  it('abre a conversa mais recente, com a timeline antes de a lista de agentes chegar', async () => {
    seed(stored('c1', 'Antiga', at(10, 20)), stored('c2', 'Recente', at(10, 24, 9)))
    api.agents.list.mockReturnValue(new Promise(() => {}))
    await renderScreen()

    expect(item('Recente')).toHaveAttribute('aria-current', 'true')
    expect(within(main()).getByRole('heading', { name: 'Recente' })).toBeInTheDocument()
    expect(screen.getAllByTestId('agent-reply')).toHaveLength(1)
    expect(screen.queryByText('Carregando agentes…', { selector: 'p' })).toBeNull()
  })

  it('task pendente: retoma a mesma task, sem chat.send, com prazo novo a partir da abertura', async () => {
    const view = await renderScreen()
    await sendMessage('oi')
    await advance(1000)
    vi.setSystemTime(Date.now() + 10 * 60_000)
    api.chat.getTask.mockClear()

    await reopen(view)
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledWith(ATENDENTE.id, TASK_ID)
    expect(api.chat.send).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Processando')

    await advance(87_000)
    expect(alertWith('O agente não respondeu a tempo.')).toBeUndefined()
    await advance(3000)
    expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
  })

  it('reabrir com a resposta pronta mostra a resposta', async () => {
    const view = await renderScreen()
    await sendMessage('oi')
    view.unmount()
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'pronta'))

    await renderScreen()
    await advance(1000)
    expect(screen.getByText('pronta')).toBeInTheDocument()
    expect(api.chat.send).toHaveBeenCalledOnce()
  })

  it('só a conversa aberta é consultada', async () => {
    seed(stored('c1', 'Primeira', at(10, 24, 9), pending(OTHER_TASK)), stored('c2', 'Segunda', at(10, 24, 10), pending()))
    await renderScreen()
    await advance(3000)

    expect(api.chat.getTask.mock.calls.length).toBeGreaterThan(0)
    for (const [, taskId] of api.chat.getTask.mock.calls) expect(taskId).toBe(TASK_ID)
  })

  it('envio interrompido: bloco próprio, e Reenviar usa o mesmo texto e o contextId', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9), { kind: 'sending' }))
    await renderScreen()

    const block = alertWith('O app foi fechado durante o envio.')!
    expect(block).toHaveTextContent('Não foi possível confirmar o envio da mensagem.')
    fireEvent.click(within(block).getByRole('button', { name: 'Reenviar' }))
    await flush()
    expect(api.chat.send).toHaveBeenCalledWith(ATENDENTE.id, 'Pergunta', CONTEXT_ID)
    expect(screen.getAllByTestId('user-message')).toHaveLength(1)
  })

  it('envio retido não sai sozinho', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9), { kind: 'awaiting-login', resume: 'send' }))
    await renderScreen()
    await advance(5000)

    const block = alertWith('A mensagem não foi enviada.')!
    expect(block).toHaveTextContent('A sessão terminou antes do envio. Você pode enviá-la de novo.')
    expect(api.chat.send).not.toHaveBeenCalled()
    fireEvent.click(within(block).getByRole('button', { name: 'Reenviar' }))
    await flush()
    expect(api.chat.send).toHaveBeenCalledWith(ATENDENTE.id, 'Pergunta', CONTEXT_ID)
  })

  it('task retida vira pendente e é consultada', async () => {
    const retained: Attempt = {
      kind: 'awaiting-login',
      resume: 'poll',
      taskId: OTHER_TASK,
      state: 'TASK_STATE_WORKING',
      submittedAt: null,
      startedAtLocal: at(10, 24, 9),
      resumed: false
    }
    seed(stored('c1', 'Pergunta', at(10, 24, 9), retained))
    await renderScreen()

    expect(screen.getByRole('status')).toHaveTextContent('Processando')
    expect(screen.getByRole('status')).toHaveTextContent('task 9f8e7d6c · Working')
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledWith(ATENDENTE.id, OTHER_TASK)
  })
})

describe('várias conversas', () => {
  it('trocar de conversa durante o envio: contextId e task na origem, retomados ao voltar com o agente dela', async () => {
    seed(stored('c1', 'Antiga', at(10, 24, 9)))
    await renderScreen()
    await clickNewConversation()
    await chooseAgent('Tradutor')
    const sending = deferred<Awaited<ReturnType<ButecoApi['chat']['send']>>>()
    api.chat.send.mockReturnValueOnce(sending.promise)
    await sendMessage('nova pergunta')

    await select('Antiga')
    await act(async () => sending.resolve(sent('TASK_STATE_SUBMITTED', { taskId: OTHER_TASK, contextId: OTHER_CONTEXT })))
    await advance(3000)
    expect(api.chat.getTask).not.toHaveBeenCalled()
    expect(within(main()).getByRole('button', { name: 'Copiar ID da conversa' })).not.toHaveAttribute('title', OTHER_CONTEXT)

    await select('nova pergunta')
    expect(within(main()).getByRole('button', { name: 'Copiar ID da conversa' })).toHaveAttribute('title', OTHER_CONTEXT)
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledWith(TRADUTOR.id, OTHER_TASK)
  })

  it('cabeçalho de conversas guardadas: ontem, outro dia do ano e outro ano (barra-de-status-e-marca, D3)', async () => {
    seed(
      stored('c1', 'De ontem', at(10, 23, 9, 5)),
      stored('c2', 'Da semana', at(10, 20, 18, 40)),
      stored('c3', 'Do ano passado', at(10, 15, 14, 32, 2025))
    )
    await renderScreen()
    const header = () => screen.getByRole('banner')

    await select('De ontem')
    expect(within(header()).getByText('Iniciada ontem às 09:05')).toBeInTheDocument()
    await select('Da semana')
    expect(within(header()).getByText('Iniciada em 20 out às 18:40')).toBeInTheDocument()
    await select('Do ano passado')
    expect(within(header()).getByText('Iniciada em 15 out 2025 às 14:32')).toBeInTheDocument()
  })

  it('REJECTED com a origem fechada aparece ao voltar', async () => {
    seed(stored('c1', 'Antiga', at(10, 24, 9)))
    await renderScreen()
    await clickNewConversation()
    const sending = deferred<Awaited<ReturnType<ButecoApi['chat']['send']>>>()
    api.chat.send.mockReturnValueOnce(sending.promise)
    await sendMessage('nova pergunta')
    await select('Antiga')
    await act(async () => sending.resolve(sent('TASK_STATE_REJECTED')))

    await select('nova pergunta')
    expect(alertWith('O agente não aceitou a mensagem')).toBeDefined()
  })

  it('consulta em andamento descartada ao abrir outra conversa; o turno continua pendente', async () => {
    seed(stored('c1', 'Antiga', at(10, 24, 9)), stored('c2', 'Pendente', at(10, 24, 10), pending()))
    const query = deferred<Awaited<ReturnType<ButecoApi['chat']['getTask']>>>()
    api.chat.getTask.mockReturnValueOnce(query.promise)
    await renderScreen()
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledOnce()

    await select('Antiga')
    await act(async () => query.resolve(task('TASK_STATE_COMPLETED', 'chegou tarde')))
    await advance(3000)
    expect(api.chat.getTask).toHaveBeenCalledOnce()

    await select('Pendente')
    expect(screen.getByRole('status')).toHaveTextContent('Processando')
    expect(screen.queryByText('chegou tarde')).toBeNull()
    expect(savedConversations().find((c) => c.id === 'c2')!.turns[0]!.attempt.kind).toBe('pending')
  })

  it('resposta retomada sem horários do servidor fica sem duração', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9), pending(TASK_ID, null)))
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok', null))
    await renderScreen()
    await advance(1000)

    expect(screen.getByText('task 1a2b3c4d · Completed')).toBeInTheDocument()
  })

  it('resposta retomada → prazo esgotado → Continuar aguardando: continua sem duração pelo relógio local', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9), pending(TASK_ID, null)))
    await renderScreen()
    await advance(91_000)
    const block = alertWith('O agente não respondeu a tempo.')!
    expect(savedConversations()[0]!.turns[0]!.attempt).toMatchObject({ kind: 'timeout', resumed: true })

    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok', null))
    fireEvent.click(within(block).getByRole('button', { name: 'Continuar aguardando' }))
    await advance(1000)

    expect(screen.getByText('task 1a2b3c4d · Completed')).toBeInTheDocument()
    expect(savedConversations()[0]!.turns[0]!.attempt).toMatchObject({ kind: 'completed', durationSeconds: null })
  })

  it('resposta retomada → sessão expirada → novo login: continua sem duração pelo relógio local', async () => {
    api.auth.login.mockResolvedValue({ ok: true, value: { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } })
    seed(stored('c1', 'Pergunta', at(10, 24, 9), pending(TASK_ID, null)))
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await renderScreen()
    await advance(1000)
    expect(savedConversations()[0]!.turns[0]!.attempt).toMatchObject({ kind: 'awaiting-login', resumed: true })

    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok', null))
    fireEvent.click(within(alertWith('Sua sessão expirou.')!).getByRole('button', { name: 'Entrar novamente' }))
    await advance(300)
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Senha'), { target: { value: 's3nha' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }))
    await flush()
    await flush()
    await advance(1000)

    expect(screen.getByText('task 1a2b3c4d · Completed')).toBeInTheDocument()
  })

  it('resposta não retomada → prazo esgotado → Continuar aguardando: mede pelo relógio local', async () => {
    api.chat.send.mockResolvedValue(sent('TASK_STATE_SUBMITTED', { submittedAt: null }))
    await renderScreen()
    await sendMessage('oi')
    await advance(91_000)
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok', null))
    fireEvent.click(within(alertWith('O agente não respondeu a tempo.')!).getByRole('button', { name: 'Continuar aguardando' }))
    await advance(1000)

    expect(screen.getByText(/^task 1a2b3c4d · Completed · \d+,\d s$/)).toBeInTheDocument()
  })

  it('resposta retomada com os horários do servidor mostra a duração', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9), pending(TASK_ID, '2026-10-24T18:24:00.000Z')))
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok', '2026-10-24T18:24:03.240Z'))
    await renderScreen()
    await advance(1000)

    expect(screen.getByText('task 1a2b3c4d · Completed · 3,2 s')).toBeInTheDocument()
  })
})

describe('ordem pela última atividade', () => {
  it('a resposta faz a conversa subir', async () => {
    seed(stored('c1', 'B', at(10, 24, 9), pending()), stored('c2', 'A', at(10, 24, 10)))
    api.chat.getTask.mockResolvedValue(task('TASK_STATE_COMPLETED', 'ok'))
    await renderScreen()
    await select('B')
    expect(itemTitles()).toEqual(['A', 'B'])

    await advance(1000)
    expect(itemTitles()).toEqual(['B', 'A'])
  })

  it('abrir, retomar, Submitted → Working e o prazo esgotado não mudam a ordem', async () => {
    const submitted: Attempt = { ...pending(), state: 'TASK_STATE_SUBMITTED' } as Attempt
    seed(stored('c1', 'B', at(10, 24, 9), submitted), stored('c2', 'A', at(10, 24, 10)))
    await renderScreen()
    await select('B')
    await advance(1000)
    expect(screen.getByRole('status')).toHaveTextContent('Working')
    expect(itemTitles()).toEqual(['A', 'B'])

    await advance(91_000)
    expect(alertWith('O agente não respondeu a tempo.')).toBeDefined()
    expect(itemTitles()).toEqual(['A', 'B'])
    expect(savedConversations().find((c) => c.id === 'c1')!.lastActivityAt).toBe(at(10, 24, 9))
  })

  it('um envio novo faz a conversa subir', async () => {
    seed(stored('c1', 'B', at(10, 24, 9)), stored('c2', 'A', at(10, 24, 10)))
    await renderScreen()
    await select('B')
    await sendMessage('mais uma')

    expect(itemTitles()).toEqual(['B', 'A'])
  })
})

describe('lista', () => {
  it('grupos e horários pela última atividade', async () => {
    seed(
      stored('c1', 'Hoje cedo', at(10, 24, 9, 5)),
      stored('c2', 'De ontem', at(10, 23)),
      stored('c3', 'Da terça', at(10, 20)),
      stored('c4', 'Do dia 15', at(10, 15)),
      stored('c5', 'Do ano passado', at(10, 15, 12, 0, 2025))
    )
    await renderScreen()

    const labels = within(list()).getAllByText(/^(Hoje|Ontem|Esta semana|Anteriores)$/)
    expect(labels.map((label) => label.textContent)).toEqual(['Hoje', 'Ontem', 'Esta semana', 'Anteriores'])
    expect(item(/^Hoje cedo/)).toHaveTextContent('Atendente · 09:05')
    expect(item(/^De ontem/)).toHaveTextContent('Atendente · ontem')
    expect(item(/^Da terça/)).toHaveTextContent('Atendente · ter')
    expect(item(/^Do dia 15/)).toHaveTextContent('Atendente · 15 out')
    expect(item(/^Do ano passado/)).toHaveTextContent('Atendente · 15 out 2025')
  })

  it('grupo vazio fica escondido', async () => {
    seed(stored('c1', 'Uma', at(10, 24, 9)), stored('c2', 'Outra', at(10, 24, 10)))
    await renderScreen()

    expect(within(list()).getByText('Hoje')).toBeInTheDocument()
    expect(within(list()).queryByText('Ontem')).toBeNull()
  })

  it('item ativo com aria-current e o selecionado abre na área principal', async () => {
    seed(stored('c1', 'Resumo da reunião', at(10, 24, 9)), stored('c2', 'Outra', at(10, 24, 10)))
    await renderScreen()
    await select(/^Resumo da reunião/)

    expect(item(/^Resumo da reunião/)).toHaveAttribute('aria-current', 'true')
    expect(item(/^Outra/)).not.toHaveAttribute('aria-current')
    expect(within(main()).getByRole('heading', { name: 'Resumo da reunião' })).toBeInTheDocument()
  })

  it('busca sem acento e sem diferenciar maiúsculas', async () => {
    seed(stored('c1', 'Situação do pedido', at(10, 24, 9)), stored('c2', 'Resumo da reunião', at(10, 24, 10)))
    await renderScreen()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar conversas' }), { target: { value: 'SITUACAO' } })

    expect(itemTitles()).toEqual(['Situação do pedido'])
  })

  it('busca sem resultado', async () => {
    seed(stored('c1', 'Situação do pedido', at(10, 24, 9)))
    await renderScreen()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar conversas' }), { target: { value: 'xyz' } })

    expect(within(list()).getByText('Nenhuma conversa encontrada.')).toBeInTheDocument()
    expect(within(list()).queryByText('Hoje')).toBeNull()
  })

  it('Nova conversa no topo de Hoje; o rascunho sai da lista ao abrir outra', async () => {
    seed(stored('c1', 'Antiga', at(10, 24, 9)))
    await renderScreen()
    await clickNewConversation()

    expect(itemTitles()).toEqual(['Nova conversa', 'Antiga'])
    expect(item(/^Nova conversa/)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('NOVA CONVERSA COM')).toBeInTheDocument()

    await select('Antiga')
    expect(itemTitles()).toEqual(['Antiga'])
  })

  it('o rascunho não tem lixeira', async () => {
    await renderScreen()

    expect(within(list()).queryByRole('button', { name: /^Excluir conversa/ })).toBeNull()
  })

  it('agente que sumiu da plataforma: o item mostra o nome guardado', async () => {
    seed(stored('c1', 'Velha', at(10, 24, 9), completed(at(10, 24, 9)), SUMIDO))
    await renderScreen()

    expect(item(/^Velha/)).toHaveTextContent('Sumido · 09:00')
  })
})

describe('Nova conversa e troca de agente', () => {
  it('troca com o rascunho aberto muda o agente dele', async () => {
    await renderScreen()
    await chooseAgent('Tradutor')

    expect(itemTitles()).toEqual(['Nova conversa'])
    expect(screen.getByText('NOVA CONVERSA COM').parentElement).toHaveTextContent('Tradutor')
  })

  it('Nova conversa com o rascunho aberto não cria outra e recarrega a lista', async () => {
    await renderScreen()
    await clickNewConversation()

    expect(itemTitles()).toEqual(['Nova conversa'])
    expect(api.agents.list).toHaveBeenCalledTimes(2)
  })

  it('Nova conversa a partir de agente inativo usa o primeiro ativo', async () => {
    seed(stored('c1', 'Velha', at(10, 24, 9), completed(at(10, 24, 9)), ANTIGO))
    await renderScreen()
    await clickNewConversation()

    expect(screen.getByText('NOVA CONVERSA COM').parentElement).toHaveTextContent('Atendente')
  })
})

describe('agente da conversa', () => {
  it('desconhecido durante a carga: sem selo de estado, composer e seletor bloqueados', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9)))
    api.agents.list.mockReturnValue(new Promise(() => {}))
    await renderScreen()

    const header = screen.getByRole('banner')
    expect(within(header).getByText('Atendente')).toBeInTheDocument()
    expect(within(header).queryByText('Ativo')).toBeNull()
    expect(within(header).queryByText('Inativo')).toBeNull()
    expect(messageBox()).toHaveAttribute('placeholder', 'Carregando agentes…')
    expect(messageBox()).toBeDisabled()
    expect(agentSelect()).toBeDisabled()
    expect(agentSelect()).toHaveValue('Atendente')
  })

  it('a lista chega com o agente ativo: o composer libera', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9)))
    const agents = deferred<Result<AgentSummary[]>>()
    api.agents.list.mockReturnValueOnce(agents.promise)
    await renderScreen()
    await act(async () => agents.resolve({ ok: true, value: [ATENDENTE] }))

    expect(messageBox()).toHaveAttribute('placeholder', 'Mensagem para Atendente')
    expect(within(screen.getByRole('banner')).getByText('Ativo')).toBeInTheDocument()
  })

  it('falha da primeira carga com conversa: legível, bloco acima do composer e Tentar de novo', async () => {
    seed(stored('c1', 'Pergunta', at(10, 24, 9)))
    api.agents.list.mockResolvedValueOnce({ ok: false, error: { kind: 'unreachable', message: 'net::ERR' } })
    await renderScreen()

    expect(screen.getAllByTestId('agent-reply')).toHaveLength(1)
    const block = alertWith('Não foi possível carregar os agentes.')!
    expect(messageBox()).toHaveAttribute('placeholder', 'Agentes indisponíveis no momento')
    expect(within(screen.getByRole('banner')).queryByText('Inativo')).toBeNull()
    fireEvent.click(within(block).getByRole('button', { name: 'Tentar de novo' }))
    await flush()
    expect(api.agents.list).toHaveBeenCalledTimes(2)
    expect(alertWith('Não foi possível carregar os agentes.')).toBeUndefined()
  })

  it('agente ausente da lista: Inativo, seletor com "(inativo)" e composer bloqueado', async () => {
    seed(stored('c1', 'Velha', at(10, 24, 9), completed(at(10, 24, 9)), SUMIDO))
    await renderScreen()

    expect(within(screen.getByRole('banner')).getByText('Inativo')).toBeInTheDocument()
    expect(agentSelect()).toHaveValue('Sumido (inativo)')
    expect(messageBox()).toHaveAttribute('placeholder', 'Sumido está inativo. Escolha outro agente ou comece uma nova conversa.')
    expect(screen.getByTestId('agent-reply')).toHaveTextContent('Sumido')
  })
})

describe('Excluir conversa', () => {
  const trash = (title: string) => within(list()).getByRole('button', { name: `Excluir conversa ${title}` })
  const dialog = () => screen.getByRole('dialog')
  const confirmDelete = async () => {
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Excluir conversa' }))
    await advance(300)
  }

  it('outra conversa: sai da lista e da chave, e a aberta continua', async () => {
    seed(stored('c1', 'B', at(10, 24, 9)), stored('c2', 'A', at(10, 24, 10)))
    await renderScreen()
    fireEvent.click(trash('B'))
    await advance(300)

    expect(dialog()).toHaveTextContent('Excluir esta conversa? Ela será apagada deste computador e não poderá ser recuperada.')
    expect(dialog()).not.toHaveTextContent('A resposta pendente')
    const button = within(dialog()).getByRole('button', { name: 'Excluir conversa' })
    expect(button.getAttribute('style')).toContain('red-filled')
    await confirmDelete()

    expect(itemTitles()).toEqual(['A'])
    expect(savedConversations().map((c) => c.id)).toEqual(['c2'])
    expect(item('A')).toHaveAttribute('aria-current', 'true')
  })

  it('a aberta: dá lugar à conversa vazia do mesmo agente', async () => {
    seed(stored('c1', 'Velha', at(10, 24, 9), completed(at(10, 24, 9)), TRADUTOR))
    await renderScreen()
    fireEvent.click(trash('Velha'))
    await advance(300)
    await confirmDelete()

    expect(savedConversations()).toEqual([])
    expect(itemTitles()).toEqual(['Nova conversa'])
    expect(screen.getByText('NOVA CONVERSA COM').parentElement).toHaveTextContent('Tradutor')
  })

  it('com resposta pendente: o modal avisa, e nenhuma consulta acontece depois', async () => {
    seed(stored('c1', 'Pendente', at(10, 24, 9), pending()))
    await renderScreen()
    await advance(1000)
    fireEvent.click(trash('Pendente'))
    await advance(300)

    expect(dialog()).toHaveTextContent(
      'A resposta pendente será descartada: a task continua no servidor, mas o app deixa de acompanhá-la.'
    )
    await confirmDelete()
    const consultas = api.chat.getTask.mock.calls.length
    await advance(5000)
    expect(api.chat.getTask).toHaveBeenCalledTimes(consultas)
  })

  it('envio em andamento de uma conversa excluída é descartado', async () => {
    await renderScreen()
    const sending = deferred<Awaited<ReturnType<ButecoApi['chat']['send']>>>()
    api.chat.send.mockReturnValueOnce(sending.promise)
    await sendMessage('vai sumir')
    fireEvent.click(trash('vai sumir'))
    await advance(300)
    await confirmDelete()
    await act(async () => sending.resolve(sent()))
    await advance(3000)

    expect(within(list()).queryByRole('button', { name: /^vai sumir/ })).toBeNull()
    expect(savedConversations()).toEqual([])
    expect(api.chat.getTask).not.toHaveBeenCalled()
  })

  it('Cancelar fecha sem mudar nada', async () => {
    seed(stored('c1', 'Fica', at(10, 24, 9)))
    await renderScreen()
    fireEvent.click(trash('Fica'))
    await advance(300)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
    await advance(300)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(itemTitles()).toEqual(['Fica'])
    expect(savedConversations().map((c) => c.id)).toEqual(['c1'])
  })
})

describe('sessão expirada com várias conversas', () => {
  beforeEach(() => {
    api.auth.login.mockResolvedValue({ ok: true, value: { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } })
  })

  async function relogin() {
    fireEvent.click(within(alertWith('Sua sessão expirou.')!).getByRole('button', { name: 'Entrar novamente' }))
    await advance(300)
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Senha'), { target: { value: 's3nha' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }))
    await flush()
    await flush()
    await advance(300)
  }

  it('busca e seleção liberadas; Nova conversa, seletor e lixeira bloqueados', async () => {
    seed(stored('c1', 'Outra', at(10, 24, 9)), stored('c2', 'Atual', at(10, 24, 10)))
    api.chat.send.mockResolvedValueOnce(UNAUTHORIZED)
    await renderScreen()
    await sendMessage('oi')

    expect(screen.getByRole('button', { name: 'Nova conversa' })).toBeDisabled()
    expect(agentSelect()).toBeDisabled()
    expect(within(list()).getByRole('button', { name: 'Excluir conversa Outra' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar conversas' }), { target: { value: 'outra' } })
    await select('Outra')
    expect(within(main()).getByRole('heading', { name: 'Outra' })).toBeInTheDocument()
    expect(alertWith('Sua sessão expirou.')).toBeDefined()
    expect(messageBox()).toHaveAttribute('placeholder', 'Entre novamente para continuar')
  })

  it('abrir uma conversa pendente durante a expiração guarda a task, sem consulta', async () => {
    seed(stored('c1', 'Pendente', at(10, 24, 9), pending(OTHER_TASK)), stored('c2', 'Atual', at(10, 24, 10)))
    api.chat.send.mockResolvedValueOnce(UNAUTHORIZED)
    await renderScreen()
    await sendMessage('oi')
    await select('Pendente')
    await advance(3000)

    expect(api.chat.getTask).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Aguardando novo login para retomar')
    expect(screen.getByRole('status')).toHaveTextContent('task 9f8e7d6c · Working')
  })

  it('envio retido em A com B aberta: um único chat.send de A no novo login', async () => {
    seed(stored('c1', 'B', at(10, 24, 9)))
    await renderScreen()
    await clickNewConversation()
    await chooseAgent('Tradutor')
    api.chat.send.mockResolvedValueOnce(UNAUTHORIZED)
    await sendMessage('retida')
    await select('B')
    await relogin()

    expect(api.chat.send).toHaveBeenCalledTimes(2)
    expect(api.chat.send).toHaveBeenLastCalledWith(TRADUTOR.id, 'retida', null)
    expect(item('B')).toHaveAttribute('aria-current', 'true')
  })

  it('task de A com B aberta: consultada só ao abrir A', async () => {
    seed(stored('c1', 'B', at(10, 24, 9)), stored('c2', 'A', at(10, 24, 10), pending(OTHER_TASK)))
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await renderScreen()
    await advance(1000)
    await select('B')
    api.chat.getTask.mockClear()
    await relogin()
    await advance(3000)
    expect(api.chat.getTask).not.toHaveBeenCalled()

    await select('A')
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledWith(ATENDENTE.id, OTHER_TASK)
  })

  it('Sair com resposta pendente: um novo login no mesmo serviço mostra a conversa pendente', async () => {
    const view = await renderScreen()
    await sendMessage('oi')
    api.chat.getTask.mockResolvedValueOnce(UNAUTHORIZED)
    await advance(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await flush()
    view.unmount()
    api.chat.getTask.mockClear()

    await renderScreen()
    expect(within(main()).getByRole('heading', { name: 'oi' })).toBeInTheDocument()
    await advance(1000)
    expect(api.chat.getTask).toHaveBeenCalledWith(ATENDENTE.id, TASK_ID)
  })
})

describe('Sair e serviços', () => {
  it('Sair e entrar de novo no mesmo serviço mostra a mesma lista', async () => {
    seed(stored('c1', 'Guardada', at(10, 24, 9)))
    await renderScreen()
    api.auth.status.mockResolvedValue({ authenticated: false, serviceUrl: null, username: null, expiresAt: null })
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await flush()
    await flush()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()

    api.auth.status.mockResolvedValue(loggedIn())
    // Sem endereço salvo (o teste não passou pelo primeiro login): a tela de primeiro acesso pede o endereço.
    const address = screen.queryByLabelText('Endereço do serviço')
    if (address) fireEvent.change(address, { target: { value: BASE } })
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 's3nha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await flush()
    await flush()
    await flush()

    expect(itemTitles()).toEqual(['Guardada'])
    expect(item('Guardada')).toHaveAttribute('aria-current', 'true')
  })

  it('outro serviço mostra outra lista', async () => {
    seed(stored('c1', 'Deste serviço', at(10, 24, 9)))
    localStorage.setItem(
      `${SESSIONS_PREFIX}https://host/buteco`,
      JSON.stringify({ version: 1, conversations: [stored('c2', 'Do outro', at(10, 24, 10))] })
    )
    api.auth.status.mockResolvedValue(loggedIn(30, 'https://host/buteco'))
    await renderScreen()

    expect(itemTitles()).toEqual(['Do outro'])
  })
})

describe('timeline', () => {
  it('separadores numa conversa reaberta', async () => {
    const conversation: Conversation = {
      ...stored('c1', 'Longa', at(10, 24, 9)),
      turns: [
        { id: 1, text: 'primeira', sentAt: at(10, 20), attempt: completed(at(10, 20)) },
        { id: 2, text: 'segunda', sentAt: at(10, 23), attempt: completed(at(10, 23)) },
        { id: 3, text: 'terceira', sentAt: at(10, 24, 9), attempt: completed(at(10, 24, 9)) }
      ]
    }
    seed(conversation)
    await renderScreen()

    const labels = within(main()).getAllByText(/^(Hoje|Ontem|\d{2}\/\d{2}\/\d{4})$/)
    expect(labels.map((label) => label.textContent)).toEqual(['20/10/2026', 'Ontem', 'Hoje'])
  })

})
