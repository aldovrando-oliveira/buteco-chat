import type { Attempt, Conversation } from '../conversation/model'

/**
 * Normalização ao reabrir (historico-conversas, D15): o disco guarda o estado do momento em que o app fechou. Não muda
 * `lastActivityAt` (D9).
 */
export function normalizeAttempt(attempt: Attempt): Attempt {
  if (attempt.kind === 'sending') return { kind: 'interrupted' }
  if (attempt.kind !== 'awaiting-login') return attempt
  if (attempt.resume === 'send') return { kind: 'not-sent' }
  const { taskId, state, submittedAt, startedAtLocal, resumed } = attempt
  return { kind: 'pending', taskId, state, submittedAt, startedAtLocal, resumed }
}

export function normalizeConversation(conversation: Conversation): Conversation {
  return { ...conversation, turns: conversation.turns.map((turn) => ({ ...turn, attempt: normalizeAttempt(turn.attempt) })) }
}
