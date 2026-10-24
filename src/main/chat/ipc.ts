import { MAX_MESSAGE_LENGTH } from '../../shared/api'
import { isGuid, isTaskOrContextId } from '../../shared/ids'
import { IpcChannels } from '../../shared/ipc-channels'
import { parseNoArgs } from '../auth/ipc'
import { handle } from '../ipc/handle'
import type { ChatClient } from './client'

export { MAX_MESSAGE_LENGTH }

// Mensagens fixas, sem nenhum valor recebido: o Electron imprime no stderr o erro de um handler que rejeita, com a
// `cause` (login-operador, D7). O texto de uma mensagem pode ter dados sensíveis do usuário.

/** `chat:send`: (agentId GUID, texto de 1 a 16 000 caracteres não só de espaços, contextId válido ou null). */
export function parseSendArgs(args: unknown[]): [string, string, string | null] {
  if (args.length !== 3) throw new TypeError('chat:send espera 3 argumentos.')
  const [agentId, text, contextId] = args
  if (!isGuid(agentId)) throw new TypeError('agentId inválido.')
  if (typeof text !== 'string') throw new TypeError('texto da mensagem deve ser string.')
  if (text.length > MAX_MESSAGE_LENGTH) throw new RangeError('texto da mensagem excede o limite.')
  if (text.trim() === '') throw new RangeError('texto da mensagem vazio.')
  if (contextId !== null && !isTaskOrContextId(contextId)) throw new TypeError('contextId inválido.')
  return [agentId, text, contextId]
}

/** `chat:getTask`: (agentId GUID, taskId válido). */
export function parseGetTaskArgs(args: unknown[]): [string, string] {
  if (args.length !== 2) throw new TypeError('chat:getTask espera 2 argumentos.')
  const [agentId, taskId] = args
  if (!isGuid(agentId)) throw new TypeError('agentId inválido.')
  if (!isTaskOrContextId(taskId)) throw new TypeError('taskId inválido.')
  return [agentId, taskId]
}

/** Registra `agents:list`, `chat:send` e `chat:getTask`. O token fica no cliente, nunca nos valores devolvidos. */
export function registerChatHandlers(chat: ChatClient): void {
  handle(IpcChannels.agentsList, parseNoArgs, () => chat.listAgents())
  handle(IpcChannels.chatSend, parseSendArgs, (agentId, text, contextId) => chat.send(agentId, text, contextId))
  handle(IpcChannels.chatGetTask, parseGetTaskArgs, (agentId, taskId) => chat.getTask(agentId, taskId))
}
