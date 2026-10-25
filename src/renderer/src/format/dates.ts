/**
 * Datas e horários compartilhados pela tela de conversas e pela lista de conversas (barra-de-status-e-marca, D3).
 * Abreviações por tabela fixa: a saída do `Intl` em pt-BR tem ponto ("out.") e varia com a versão do ICU.
 */

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** `HH:mm` no relógio local. */
export function formatTime(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Dias de calendário local entre `ms` e `now` (positivo no passado). */
export function daysAgo(ms: number, now: number): number {
  const day = new Date(ms)
  const today = new Date(now)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // Arredonda: um dia com horário de verão tem 23 ou 25 h.
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

/** `dd mmm` ("15 out"), com o ano quando ele não é o de `now` ("15 out 2025"). */
export function dayMonth(ms: number, now: number): string {
  const date = new Date(ms)
  const text = `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}`
  return date.getFullYear() === new Date(now).getFullYear() ? text : `${text} ${date.getFullYear()}`
}
