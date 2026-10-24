import type { Conversation } from '../conversation/model'
import { normalizeConversation } from './normalize'
import { parseStoredConversation } from './validate'

/**
 * Histórico local por serviço (historico-conversas, D3, D4, D5 e D8). O `Storage` é injetado: em produção, o
 * `localStorage` do renderer. Nenhuma função lança: sem armazenamento, o app segue com as conversas em memória.
 */

export const SESSIONS_PREFIX = 'buteco-chat:sessions:'
/** Prefixo, e não sufixo: o `baseUrl` pode conter `:` e tornaria ambígua a varredura das chaves de sessão (D5). */
export const CORRUPT_PREFIX = 'buteco-chat:sessions-corrupt:'
export const FORMAT_VERSION = 1
export const MAX_CONVERSATIONS = 100

export interface HistoryStore {
  /** Conversas válidas do serviço, já normalizadas (D15). */
  load(): Conversation[]
  /**
   * Grava as conversas com turnos. Devolve os ids do serviço atual que saíram pelo teto ou pela cota, para a tela
   * tirá-los da lista. A conversa `openId` nunca sai.
   */
  save(conversations: readonly Conversation[], openId: string | null): string[]
}

type Json = Record<string, unknown>
type OtherService = { key: string; data: Json; list: unknown[] }
type OtherCandidate = OtherService & { index: number; at: number }

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
}

/** Remove a conversa de `lastActivityAt` mais antigo, exceto `openId`. Devolve o id removido, ou `null`. */
function dropOldest(conversations: Conversation[], openId: string | null): string | null {
  let oldest = -1
  conversations.forEach((conversation, index) => {
    if (conversation.id === openId) return
    if (oldest === -1 || conversation.lastActivityAt < conversations[oldest]!.lastActivityAt) oldest = index
  })
  if (oldest === -1) return null
  const [removed] = conversations.splice(oldest, 1)
  return removed!.id
}

export function createHistoryStore(getStorage: () => Storage, baseUrl: string): HistoryStore {
  const key = `${SESSIONS_PREFIX}${baseUrl}`
  // Só-memória: versão maior que a conhecida, que nunca é sobrescrita, ou armazenamento ilegível (D5).
  let memoryOnly = false

  function keepCorruptCopy(raw: string): void {
    try {
      getStorage().setItem(`${CORRUPT_PREFIX}${baseUrl}`, raw)
    } catch {
      // Sem espaço ou sem armazenamento: o app segue sem a cópia.
    }
  }

  function load(): Conversation[] {
    let raw: string | null
    try {
      raw = getStorage().getItem(key)
    } catch {
      memoryOnly = true
      return []
    }
    if (raw === null) return []
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      data = null
    }
    const version = isObject(data) ? data['version'] : undefined
    if (!isObject(data) || !Number.isInteger(version) || (version as number) < 1) {
      keepCorruptCopy(raw)
      return []
    }
    if ((version as number) > FORMAT_VERSION) {
      memoryOnly = true
      return []
    }
    if (!Array.isArray(data['conversations'])) {
      keepCorruptCopy(raw)
      return []
    }
    const seen = new Set<string>()
    const conversations: Conversation[] = []
    for (const item of data['conversations']) {
      const conversation = parseStoredConversation(item)
      if (conversation === null || seen.has(conversation.id)) continue
      seen.add(conversation.id)
      conversations.push(normalizeConversation(conversation))
    }
    return conversations
  }

  /** Chaves de outros serviços em `version: 1`, com o JSON já lido, para o LRU entre serviços (D8). */
  function otherServices(storage: Storage, untouchable: Set<string>): OtherService[] {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const candidate = storage.key(i)
      if (candidate !== null && candidate.startsWith(SESSIONS_PREFIX) && candidate !== key) keys.push(candidate)
    }
    const result: OtherService[] = []
    for (const other of keys) {
      if (untouchable.has(other)) continue
      try {
        const data: unknown = JSON.parse(storage.getItem(other) ?? '')
        if (isObject(data) && data['version'] === FORMAT_VERSION && Array.isArray(data['conversations'])) {
          result.push({ key: other, data, list: data['conversations'] })
        }
      } catch {
        // JSON inválido de outro serviço: não é tocado.
      }
    }
    return result
  }

  function removeCorruptCopies(storage: Storage): void {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const candidate = storage.key(i)
      if (candidate !== null && candidate.startsWith(CORRUPT_PREFIX)) keys.push(candidate)
    }
    for (const corrupt of keys) storage.removeItem(corrupt)
  }

  /**
   * Remove a conversa mais antiga entre o serviço atual (exceto a aberta) e os outros serviços. Devolve `false` se
   * não sobrou nada a remover.
   */
  function evictOldest(
    storage: Storage,
    persisted: Conversation[],
    openId: string | null,
    removed: string[],
    untouchable: Set<string>
  ): boolean {
    let localIndex = -1
    for (const [index, conversation] of persisted.entries()) {
      if (conversation.id === openId) continue
      if (localIndex === -1 || conversation.lastActivityAt < persisted[localIndex]!.lastActivityAt) localIndex = index
    }
    let other: OtherCandidate | null = null
    for (const service of otherServices(storage, untouchable)) {
      for (const [index, item] of service.list.entries()) {
        const at = isObject(item) ? item['lastActivityAt'] : undefined
        if (typeof at !== 'number' || !Number.isFinite(at)) continue
        if (other === null || at < other.at) other = { ...service, index, at }
      }
    }
    const local = localIndex === -1 ? null : persisted[localIndex]!
    if (local !== null && (other === null || local.lastActivityAt <= other.at)) {
      persisted.splice(localIndex, 1)
      removed.push(local.id)
      return true
    }
    if (other === null) return false
    const { index: otherIndex } = other
    const list = other.list.filter((_, index) => index !== otherIndex)
    try {
      storage.setItem(other.key, JSON.stringify({ ...other.data, conversations: list }))
    } catch {
      // Não deu para reescrever a outra chave: ela sai da disputa para o laço terminar.
      untouchable.add(other.key)
    }
    return true
  }

  function save(conversations: readonly Conversation[], openId: string | null): string[] {
    if (memoryOnly) return []
    const persisted = conversations.filter((conversation) => conversation.turns.length > 0)
    const removed: string[] = []
    while (persisted.length > MAX_CONVERSATIONS) {
      const id = dropOldest(persisted, openId)
      if (id === null) break
      removed.push(id)
    }
    let storage: Storage
    try {
      storage = getStorage()
    } catch {
      return removed
    }
    const write = () => storage.setItem(key, JSON.stringify({ version: FORMAT_VERSION, conversations: persisted }))
    try {
      write()
      return removed
    } catch (error) {
      if (!isQuotaExceeded(error)) return removed
    }
    try {
      removeCorruptCopies(storage)
      write()
      return removed
    } catch (error) {
      if (!isQuotaExceeded(error)) return removed
    }
    const untouchable = new Set<string>()
    while (evictOldest(storage, persisted, openId, removed, untouchable)) {
      try {
        write()
        return removed
      } catch (error) {
        if (!isQuotaExceeded(error)) return removed
      }
    }
    // Só a aberta e ainda sem espaço: continua em memória, e a próxima gravação tenta de novo (D8).
    return removed
  }

  return { load, save }
}
