/**
 * Identificadores do contrato A2A (design D3 da conversa-a2a). Usados pelo main no `parseArgs` e nas respostas da
 * plataforma, para o renderer nunca receber um id que o IPC recusaria depois.
 */

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const TASK_OR_CONTEXT_ID = /^[A-Za-z0-9._:-]{1,128}$/

/** `agentId` entra no caminho da URL: só GUID, o que exclui `/`, `..`, `?`, `#` e `%` por construção. */
export function isGuid(value: unknown): value is string {
  return typeof value === 'string' && GUID.test(value)
}

/** `taskId` e `contextId` são opacos para o contrato; a regra só limita formato e tamanho. */
export function isTaskOrContextId(value: unknown): value is string {
  return typeof value === 'string' && TASK_OR_CONTEXT_ID.test(value)
}
