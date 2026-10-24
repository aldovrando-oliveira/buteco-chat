import { formatTime } from '../conversation/format'

/**
 * Grupos, horário do item e busca da lista de conversas (historico-conversas, D16). Abreviações por tabela fixa: a
 * saída do `Intl` em pt-BR tem ponto ("seg.", "out.") e varia com a versão do ICU.
 */

export type ListGroup = 'today' | 'yesterday' | 'week' | 'older'

export const GROUP_LABELS: Record<ListGroup, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta semana',
  older: 'Anteriores'
}

export const GROUP_ORDER: readonly ListGroup[] = ['today', 'yesterday', 'week', 'older']

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Dias de calendário local entre `ms` e `now` (positivo no passado). */
function daysAgo(ms: number, now: number): number {
  const day = new Date(ms)
  const today = new Date(now)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // Arredonda: um dia com horário de verão tem 23 ou 25 h.
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

/** Hoje (inclusive datas futuras), ontem, de 2 a 6 dias atrás, ou 7 dias ou mais. */
export function groupOf(lastActivityAt: number, now: number): ListGroup {
  const days = daysAgo(lastActivityAt, now)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days <= 6) return 'week'
  return 'older'
}

/** `HH:mm`, "ontem", o dia da semana ("seg") ou `dd mmm` ("15 out"), com o ano quando ele é outro. */
export function itemTime(lastActivityAt: number, now: number): string {
  const group = groupOf(lastActivityAt, now)
  if (group === 'today') return formatTime(lastActivityAt)
  if (group === 'yesterday') return 'ontem'
  const date = new Date(lastActivityAt)
  if (group === 'week') return WEEKDAYS[date.getDay()]!
  const dayMonth = `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}`
  return date.getFullYear() === new Date(now).getFullYear() ? dayMonth : `${dayMonth} ${date.getFullYear()}`
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/** "Contém", sem diferenciar maiúsculas nem acentos; espaços nas pontas da busca ignorados, e a vazia aceita tudo. */
export function matchesSearch(title: string, query: string): boolean {
  const needle = fold(query.trim())
  return needle === '' || fold(title).includes(needle)
}
