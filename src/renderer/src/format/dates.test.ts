import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayMonth, daysAgo, formatTime } from './dates'

const now = new Date(2026, 9, 24, 15, 0).getTime()

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('formatTime', () => {
  it('HH:mm local', () => {
    expect(formatTime(new Date(2026, 9, 24, 9, 5).getTime())).toBe('09:05')
  })
})

describe('daysAgo', () => {
  it('dias de calendário local, positivo no passado e negativo no futuro', () => {
    expect(daysAgo(new Date(2026, 9, 24, 0, 1).getTime(), now)).toBe(0)
    expect(daysAgo(new Date(2026, 9, 23, 23, 59).getTime(), now)).toBe(1)
    expect(daysAgo(new Date(2026, 9, 17, 12, 0).getTime(), now)).toBe(7)
    expect(daysAgo(new Date(2026, 9, 25, 1, 0).getTime(), now)).toBe(-1)
  })

  it('o dia de 23 h do horário de verão conta como um dia', () => {
    // Em São Paulo, o horário de verão de 2018 começou em 04/11: do início de 04/11 ao de 05/11 há 23 h.
    vi.stubEnv('TZ', 'America/Sao_Paulo')

    expect(daysAgo(new Date(2018, 10, 4, 23, 30).getTime(), new Date(2018, 10, 5, 12, 0).getTime())).toBe(1)
  })
})

describe('dayMonth', () => {
  it('dd mmm sem ponto, com o ano quando é outro', () => {
    expect(dayMonth(new Date(2026, 9, 5).getTime(), now)).toBe('05 out')
    expect(dayMonth(new Date(2026, 0, 15).getTime(), now)).toBe('15 jan')
    expect(dayMonth(new Date(2025, 9, 15).getTime(), now)).toBe('15 out 2025')
  })
})
