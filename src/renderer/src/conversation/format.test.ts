import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  conversationTitle,
  dayLabel,
  durationSeconds,
  formatCount,
  formatSeconds,
  initials,
  shortTaskId,
  startedLabel,
  stateLabel
} from './format'

describe('conversationTitle', () => {
  it('mensagem curta fica inteira, sem quebras nem espaços nas pontas', () => {
    expect(conversationTitle('  oi\n\ntudo   bem? ')).toBe('oi tudo bem?')
  })

  it('60 caracteres com quebra: 40 primeiros, sem a quebra, e "…"', () => {
    const text = `${'a'.repeat(20)}\n${'b'.repeat(39)}`
    expect(text).toHaveLength(60)

    expect(conversationTitle(text)).toBe(`${'a'.repeat(20)} ${'b'.repeat(19)}…`)
  })

  it('exatamente 40 caracteres, sem "…"', () => {
    expect(conversationTitle('x'.repeat(40))).toBe('x'.repeat(40))
  })
})

describe('startedLabel (barra-de-status-e-marca, D3)', () => {
  const now = new Date(2026, 9, 24, 15, 0).getTime()

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hoje, ontem, outro dia do ano e outro ano', () => {
    expect(startedLabel(new Date(2026, 9, 24, 14, 32).getTime(), now)).toBe('Iniciada hoje às 14:32')
    expect(startedLabel(new Date(2026, 9, 23, 9, 5).getTime(), now)).toBe('Iniciada ontem às 09:05')
    expect(startedLabel(new Date(2026, 9, 20, 18, 40).getTime(), now)).toBe('Iniciada em 20 out às 18:40')
    expect(startedLabel(new Date(2025, 9, 15, 14, 32).getTime(), now)).toBe('Iniciada em 15 out 2025 às 14:32')
  })

  it('de 2 a 6 dias atrás, dia e mês, não o dia da semana da lista', () => {
    expect(startedLabel(new Date(2026, 9, 22, 8, 0).getTime(), now)).toBe('Iniciada em 22 out às 08:00')
  })

  it('data futura (relógio local atrasado) conta como hoje', () => {
    expect(startedLabel(new Date(2026, 9, 25, 1, 0).getTime(), now)).toBe('Iniciada hoje às 01:00')
  })

  it('o dia de 23 h do horário de verão continua sendo "ontem"', () => {
    // Em São Paulo, o horário de verão de 2018 começou em 04/11: a meia-noite pulou para 01:00, e do início de 04/11
    // ao de 05/11 há 23 h.
    vi.stubEnv('TZ', 'America/Sao_Paulo')
    const sentAt = new Date(2018, 10, 4, 23, 30).getTime()

    expect(startedLabel(sentAt, new Date(2018, 10, 5, 12, 0).getTime())).toBe('Iniciada ontem às 23:30')
  })
})

describe('linha de metadados', () => {
  it('taskId abreviado e rótulo do estado', () => {
    expect(shortTaskId('1a2b3c4d-5e6f')).toBe('1a2b3c4d')
    expect(stateLabel('TASK_STATE_WORKING')).toBe('Working')
    expect(stateLabel('TASK_STATE_COMPLETED')).toBe('Completed')
  })

  it('duração pelos horários do servidor', () => {
    const seconds = durationSeconds(
      { submittedAt: '2026-10-24T18:24:00.000Z', timestamp: '2026-10-24T18:24:03.240Z' },
      { startedAt: 0, endedAt: 99_000 }
    )

    expect(formatSeconds(seconds)).toBe('3,2')
  })

  it.each([
    ['timestamp null', { submittedAt: '2026-10-24T18:24:00.000Z', timestamp: null }],
    ['submittedAt null', { submittedAt: null, timestamp: '2026-10-24T18:24:03.000Z' }],
    ['diferença negativa', { submittedAt: '2026-10-24T18:24:05.000Z', timestamp: '2026-10-24T18:24:00.000Z' }]
  ])('%s → relógio local', (_label, server) => {
    expect(formatSeconds(durationSeconds(server, { startedAt: 1000, endedAt: 5500 }))).toBe('4,5')
  })

  it('formata com uma casa e vírgula', () => {
    expect(formatSeconds(12)).toBe('12,0')
    expect(formatSeconds(0.04)).toBe('0,0')
  })
})

describe('contador e horários', () => {
  it('separador de milhar pt-BR', () => {
    expect(formatCount(16_000)).toBe('16.000')
    expect(formatCount(14_400)).toBe('14.400')
  })

  it('rótulo do separador de dia', () => {
    const now = new Date(2026, 9, 24, 0, 30).getTime()

    expect(dayLabel(new Date(2026, 9, 24, 0, 1).getTime(), now)).toBe('Hoje')
    expect(dayLabel(new Date(2026, 9, 23, 23, 59).getTime(), now)).toBe('Ontem')
    expect(dayLabel(new Date(2026, 9, 1, 12, 0).getTime(), now)).toBe('01/10/2026')
  })
})

describe('initials', () => {
  it.each([
    ['ana', 'AN'],
    ['ana.souza', 'AS'],
    ['Ana Souza', 'AS'],
    ['a', 'A']
  ])('%s → %s', (username, expected) => {
    expect(initials(username)).toBe(expected)
  })
})
