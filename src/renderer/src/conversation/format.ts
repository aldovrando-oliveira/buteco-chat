/** Formatação dos textos da tela de conversas (requisitos 'Cabeçalho da conversa', 'Timeline' e 'Composer'). */

export const TITLE_LENGTH = 40

/** Primeiros 40 caracteres da primeira mensagem, com espaços e quebras colapsados, e "…" se for mais longa. */
export function conversationTitle(firstMessage: string): string {
  const flat = firstMessage.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH)}…` : flat
}

/** 8 primeiros caracteres + "…" + 4 últimos; inteiro se tiver até 12. */
export function abbreviateContextId(contextId: string): string {
  return contextId.length <= 12 ? contextId : `${contextId.slice(0, 8)}…${contextId.slice(-4)}`
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

/** `HH:mm` no relógio local. */
export function formatTime(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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

/** Iniciais do avatar: primeira letra das duas primeiras partes do nome, ou as duas primeiras letras. */
export function initials(username: string): string {
  const parts = username.split(/[\s._@-]+/).filter((part) => part.length > 0)
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? '').slice(0, 2)
  return letters.toUpperCase()
}
