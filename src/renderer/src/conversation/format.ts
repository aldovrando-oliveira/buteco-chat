/** Formatação dos textos da tela de conversas (requisitos 'Cabeçalho da conversa', 'Timeline' e 'Composer'). */

import { dayMonth, daysAgo, formatTime } from '../format/dates'

export const TITLE_LENGTH = 40

/** Primeiros 40 caracteres da primeira mensagem, com espaços e quebras colapsados, e "…" se for mais longa. */
export function conversationTitle(firstMessage: string): string {
  const flat = firstMessage.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH)}…` : flat
}

export function shortTaskId(taskId: string): string {
  return taskId.slice(0, 8)
}

/** Rótulo do estado na linha de metadados: `TASK_STATE_WORKING` → `Working`. */
export function stateLabel(state: string): string {
  const name = state.replace(/^TASK_STATE_/, '').toLowerCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/**
 * Duração em segundos (design D11): horários do servidor (`timestamp` terminal − `submittedAt`); sem um deles, ou com
 * diferença negativa, o relógio local do renderer.
 */
export function durationSeconds(
  server: { submittedAt: string | null; timestamp: string | null },
  local: { startedAt: number; endedAt: number }
): number {
  return serverDurationSeconds(server) ?? Math.max(0, local.endedAt - local.startedAt) / 1000
}

/** Só a duração pelos horários do servidor; `null` sem um deles ou com diferença negativa. */
export function serverDurationSeconds(server: { submittedAt: string | null; timestamp: string | null }): number | null {
  if (server.submittedAt === null || server.timestamp === null) return null
  const diff = Date.parse(server.timestamp) - Date.parse(server.submittedAt)
  return Number.isFinite(diff) && diff >= 0 ? diff / 1000 : null
}

/** `3,2` (uma casa, vírgula decimal). */
export function formatSeconds(seconds: number): string {
  return decimal.format(seconds)
}

/** `16.000` (separador de milhar pt-BR). */
export function formatCount(n: number): string {
  return integer.format(n)
}

function startOfDay(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

/** Separador de dia: "Hoje", "Ontem" ou `dd/mm/aaaa` (D18 #14). */
export function dayLabel(ms: number, now: number): string {
  const day = startOfDay(ms)
  const today = startOfDay(now)
  if (day === today) return 'Hoje'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === yesterday.getTime()) return 'Ontem'
  const date = new Date(ms)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

/**
 * Início da conversa no cabeçalho (barra-de-status-e-marca, D3), pelo dia de calendário local: "Iniciada hoje às
 * 14:32", "Iniciada ontem às 09:05" ou "Iniciada em 20 out às 18:40" (com o ano quando é outro). Data futura conta como
 * hoje, como na lista. Depois de ontem, sempre dia e mês: o dia da semana da lista fica ambíguo fora dos grupos.
 */
export function startedLabel(sentAt: number, now: number): string {
  const days = daysAgo(sentAt, now)
  const time = formatTime(sentAt)
  if (days <= 0) return `Iniciada hoje às ${time}`
  if (days === 1) return `Iniciada ontem às ${time}`
  return `Iniciada em ${dayMonth(sentAt, now)} às ${time}`
}

/** Iniciais do avatar: primeira letra das duas primeiras partes do nome, ou as duas primeiras letras. */
export function initials(username: string): string {
  const parts = username.split(/[\s._@-]+/).filter((part) => part.length > 0)
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? '').slice(0, 2)
  return letters.toUpperCase()
}
