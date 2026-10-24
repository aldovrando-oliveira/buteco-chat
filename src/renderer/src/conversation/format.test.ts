import { describe, expect, it } from 'vitest'
import {
  abbreviateContextId,
  conversationTitle,
  dayLabel,
  durationSeconds,
  formatCount,
  formatSeconds,
  formatTime,
  initials,
  shortTaskId,
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

describe('abbreviateContextId', () => {
  it('8 primeiros + … + 4 últimos', () => {
    expect(abbreviateContextId('3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f')).toBe('3a7d9f10…4e5f')
  })

  it('até 12 caracteres fica inteiro', () => {
    expect(abbreviateContextId('ctx-1')).toBe('ctx-1')
    expect(abbreviateContextId('123456789012')).toBe('123456789012')
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

  it('HH:mm local', () => {
    expect(formatTime(new Date(2026, 9, 24, 9, 5).getTime())).toBe('09:05')
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
