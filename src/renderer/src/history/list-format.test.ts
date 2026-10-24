import { describe, expect, it } from 'vitest'
import { groupOf, itemTime, matchesSearch } from './list-format'

// Sábado, 24/10/2026, 15:00 no relógio local.
const NOW = new Date(2026, 9, 24, 15, 0).getTime()
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime()

describe('groupOf', () => {
  it('Grupos com itens: hoje, ontem, terça (20/10) e 15/10', () => {
    expect(groupOf(at(2026, 10, 24, 9, 5), NOW)).toBe('today')
    expect(groupOf(at(2026, 10, 23), NOW)).toBe('yesterday')
    expect(groupOf(at(2026, 10, 20), NOW)).toBe('week')
    expect(groupOf(at(2026, 10, 15), NOW)).toBe('older')
  })

  it('2 e 6 dias atrás são "Esta semana"; 7 já é "Anteriores"', () => {
    expect(groupOf(at(2026, 10, 22), NOW)).toBe('week')
    expect(groupOf(at(2026, 10, 18), NOW)).toBe('week')
    expect(groupOf(at(2026, 10, 17), NOW)).toBe('older')
  })

  it('meia-noite: 23:59 de ontem é "Ontem", 00:00 de hoje é "Hoje"', () => {
    expect(groupOf(at(2026, 10, 23, 23, 59), NOW)).toBe('yesterday')
    expect(groupOf(at(2026, 10, 24, 0, 0), NOW)).toBe('today')
  })

  it('data futura fica em "Hoje"', () => {
    expect(groupOf(at(2026, 10, 30), NOW)).toBe('today')
  })
})

describe('itemTime', () => {
  it('Horários por grupo', () => {
    expect(itemTime(at(2026, 10, 24, 9, 5), NOW)).toBe('09:05')
    expect(itemTime(at(2026, 10, 23), NOW)).toBe('ontem')
    expect(itemTime(at(2026, 10, 20), NOW)).toBe('ter')
    expect(itemTime(at(2026, 10, 15), NOW)).toBe('15 out')
    expect(itemTime(at(2025, 10, 15), NOW)).toBe('15 out 2025')
  })

  it('dias da semana sem ponto', () => {
    expect([18, 19, 20, 21, 22].map((day) => itemTime(at(2026, 10, day), NOW))).toEqual(['dom', 'seg', 'ter', 'qua', 'qui'])
    expect(itemTime(at(2026, 10, 24), at(2026, 10, 30))).toBe('sáb')
  })

  it('virada do ano: dezembro do ano anterior leva o ano', () => {
    const january = at(2027, 1, 10)
    expect(itemTime(at(2026, 12, 25), january)).toBe('25 dez 2026')
    expect(itemTime(at(2027, 1, 2), january)).toBe('02 jan')
  })
})

describe('matchesSearch', () => {
  it('SITUACAO acha "Situação do pedido", e não "Resumo da reunião"', () => {
    expect(matchesSearch('Situação do pedido', 'SITUACAO')).toBe(true)
    expect(matchesSearch('Resumo da reunião', 'SITUACAO')).toBe(false)
  })

  it('acento na busca acha título sem acento', () => {
    expect(matchesSearch('Reuniao de pauta', 'reunião')).toBe(true)
  })

  it('"contém" no meio do título, com espaços nas pontas ignorados', () => {
    expect(matchesSearch('Resumo da reunião', '  da reu ')).toBe(true)
  })

  it('busca vazia ou só de espaços aceita tudo', () => {
    expect(matchesSearch('Qualquer', '')).toBe(true)
    expect(matchesSearch('Qualquer', '   ')).toBe(true)
  })
})
