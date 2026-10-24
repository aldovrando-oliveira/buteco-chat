import { beforeEach, describe, expect, it } from 'vitest'
import type { Conversation } from '../conversation/model'
import { ATENDENTE, CONTEXT_ID, TASK_ID } from '../conversation/test-chat'
import { CORRUPT_PREFIX, createHistoryStore, MAX_CONVERSATIONS, SESSIONS_PREFIX } from './storage'
import { MemoryStorage } from './test-storage'

const BASE = 'http://localhost:5017'
const OTHER = 'https://host/buteco'
const KEY = `${SESSIONS_PREFIX}${BASE}`
const OTHER_KEY = `${SESSIONS_PREFIX}${OTHER}`

function conversation(id: string, lastActivityAt: number, text = 'Olá'): Conversation {
  return {
    id,
    agent: ATENDENTE,
    contextId: CONTEXT_ID,
    title: 'Olá',
    createdAt: lastActivityAt,
    lastActivityAt,
    turns: [
      {
        id: 1,
        text,
        sentAt: lastActivityAt,
        attempt: { kind: 'completed', taskId: TASK_ID, text: 'resposta', receivedAt: lastActivityAt, durationSeconds: 1 }
      }
    ]
  }
}

function draft(id: string): Conversation {
  return { ...conversation(id, 1), contextId: null, title: null, turns: [] }
}

function storedIds(storage: Storage, key = KEY): string[] {
  const data = JSON.parse(storage.getItem(key)!) as { conversations: { id: string }[] }
  return data.conversations.map((c) => c.id)
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('leitura', () => {
  it('chave ausente → lista vazia', () => {
    expect(createHistoryStore(() => storage, BASE).load()).toEqual([])
  })

  it('lê só a chave do serviço e normaliza', () => {
    const sending = { ...conversation('c1', 10), turns: [{ id: 1, text: 'a', sentAt: 10, attempt: { kind: 'sending' } }] }
    storage.setItem(KEY, JSON.stringify({ version: 1, conversations: [sending] }))
    storage.setItem(OTHER_KEY, JSON.stringify({ version: 1, conversations: [conversation('c2', 10)] }))
    const loaded = createHistoryStore(() => storage, BASE).load()
    expect(loaded.map((c) => c.id)).toEqual(['c1'])
    expect(loaded[0]!.turns[0]!.attempt).toEqual({ kind: 'interrupted' })
  })

  it.each([
    ['JSON inválido', '{"version":1,"conv'],
    ['sem version', '{"conversations":[]}'],
    ['version não inteiro', '{"version":"1","conversations":[]}'],
    ['version zero', '{"version":0,"conversations":[]}'],
    ['conversations não array', '{"version":1,"conversations":{}}'],
    ['array no topo', '[]']
  ])('%s → cópia corrompida e lista vazia', (_name, raw) => {
    storage.setItem(KEY, raw)
    const store = createHistoryStore(() => storage, BASE)
    expect(store.load()).toEqual([])
    expect(storage.getItem(`${CORRUPT_PREFIX}${BASE}`)).toBe(raw)
    // A primeira gravação sobrescreve a chave original.
    store.save([conversation('c1', 10)], 'c1')
    expect(storedIds(storage)).toEqual(['c1'])
  })

  it('cópia corrompida sem espaço → segue sem ela', () => {
    storage.setItem(KEY, '{"version":1,"conv')
    storage.quota = storage.used()
    const store = createHistoryStore(() => storage, BASE)
    expect(store.load()).toEqual([])
    expect(storage.getItem(`${CORRUPT_PREFIX}${BASE}`)).toBeNull()
  })

  it('version maior → só memória, e a chave nunca é sobrescrita', () => {
    const raw = JSON.stringify({ version: 2, conversations: [{ futuro: true }] })
    storage.setItem(KEY, raw)
    const store = createHistoryStore(() => storage, BASE)
    expect(store.load()).toEqual([])
    store.save([conversation('c1', 10)], 'c1')
    store.save([conversation('c1', 10), conversation('c2', 20)], 'c2')
    expect(storage.getItem(KEY)).toBe(raw)
  })

  it('descarta uma conversa inválida sem invalidar as outras, e mantém a primeira de ids repetidos', () => {
    const invalid = { ...conversation('c1', 10), contextId: '../x' }
    const repeated = { ...conversation('c2', 30), title: 'repetida' }
    storage.setItem(KEY, JSON.stringify({ version: 1, conversations: [invalid, conversation('c2', 20), repeated] }))
    const loaded = createHistoryStore(() => storage, BASE).load()
    expect(loaded.map((c) => [c.id, c.lastActivityAt])).toEqual([['c2', 20]])
  })

  it('getItem lançando → lista vazia e só memória', () => {
    storage.broken = true
    const store = createHistoryStore(() => storage, BASE)
    expect(store.load()).toEqual([])
    storage.broken = false
    store.save([conversation('c1', 10)], 'c1')
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('localStorage inacessível (o getter lança) → lista vazia', () => {
    const store = createHistoryStore(() => {
      throw new Error('negado')
    }, BASE)
    expect(store.load()).toEqual([])
    expect(store.save([conversation('c1', 10)], 'c1')).toEqual([])
  })
})

describe('gravação', () => {
  it('grava { version: 1, conversations } só com as conversas com turnos', () => {
    createHistoryStore(() => storage, BASE).save([draft('d1'), conversation('c1', 10)], 'd1')
    const data = JSON.parse(storage.getItem(KEY)!) as { version: number }
    expect(data.version).toBe(1)
    expect(storedIds(storage)).toEqual(['c1'])
  })

  it('setItem com outro erro → desiste sem lançar', () => {
    const store = createHistoryStore(() => storage, BASE)
    store.load()
    storage.broken = true
    expect(() => store.save([conversation('c1', 10)], 'c1')).not.toThrow()
  })

  it('teto de 100: sai a de última atividade mais antiga, nunca a aberta', () => {
    const conversations = Array.from({ length: MAX_CONVERSATIONS + 2 }, (_, i) => conversation(`c${i}`, 100 + i))
    // A aberta é a mais antiga de todas.
    const removed = createHistoryStore(() => storage, BASE).save(conversations, 'c0')
    expect(removed).toEqual(['c1', 'c2'])
    const ids = storedIds(storage)
    expect(ids).toHaveLength(MAX_CONVERSATIONS)
    expect(ids).toContain('c0')
  })

  it('nenhuma chave gravada tem token, password ou expiresAt', () => {
    createHistoryStore(() => storage, BASE).save([conversation('c1', 10)], 'c1')
    for (const { value } of storage.setItemCalls) expect(value).not.toMatch(/token|password|expiresAt/)
  })
})

describe('cota', () => {
  it('remove primeiro a cópia corrompida, depois a conversa mais antiga de qualquer serviço', () => {
    storage.setItem(`${CORRUPT_PREFIX}${OTHER}`, 'x'.repeat(300))
    storage.setItem(OTHER_KEY, JSON.stringify({ version: 1, conversations: [conversation('o1', 5, 'y'.repeat(300))] }))
    const store = createHistoryStore(() => storage, BASE)
    store.save([conversation('c1', 10)], 'c1')
    // Uma conversa nova grande: precisa da cópia e da conversa do outro serviço.
    storage.quota = storage.used() + 450
    const removed = store.save([conversation('c1', 10), conversation('c2', 20, 'z'.repeat(300))], 'c2')
    expect(removed).toEqual([])
    expect(storage.getItem(`${CORRUPT_PREFIX}${OTHER}`)).toBeNull()
    expect(storedIds(storage, OTHER_KEY)).toEqual([])
    expect(storedIds(storage)).toEqual(['c1', 'c2'])
  })

  it('só a cópia já basta: o outro serviço fica intacto', () => {
    storage.setItem(`${CORRUPT_PREFIX}${OTHER}`, 'x'.repeat(300))
    storage.setItem(OTHER_KEY, JSON.stringify({ version: 1, conversations: [conversation('o1', 5)] }))
    storage.quota = storage.used() + 300
    createHistoryStore(() => storage, BASE).save([conversation('c1', 10)], 'c1')
    expect(storage.getItem(`${CORRUPT_PREFIX}${OTHER}`)).toBeNull()
    expect(storedIds(storage, OTHER_KEY)).toEqual(['o1'])
  })

  it('remove do serviço atual quando a dele é a mais antiga, nunca a aberta', () => {
    storage.setItem(OTHER_KEY, JSON.stringify({ version: 1, conversations: [conversation('o1', 50)] }))
    storage.quota = storage.used() + 450
    const conversations = [conversation('c1', 10), conversation('c2', 20), conversation('c3', 30, 'z'.repeat(200))]
    const removed = createHistoryStore(() => storage, BASE).save(conversations, 'c3')
    expect(removed[0]).toBe('c1')
    expect(storedIds(storage)).toContain('c3')
    expect(storedIds(storage)).not.toContain('c1')
  })

  it('não toca a chave de outro serviço com versão maior ou JSON inválido', () => {
    const future = JSON.stringify({ version: 2, conversations: [{ lastActivityAt: 1 }] })
    storage.setItem(OTHER_KEY, future)
    storage.setItem(`${SESSIONS_PREFIX}http://x`, '{inválido')
    storage.quota = storage.used() + 10
    createHistoryStore(() => storage, BASE).save([conversation('c1', 10)], 'c1')
    expect(storage.getItem(OTHER_KEY)).toBe(future)
    expect(storage.getItem(`${SESSIONS_PREFIX}http://x`)).toBe('{inválido')
  })

  it('só a aberta e sem espaço → sem exceção e nada removido', () => {
    storage.quota = 10
    const store = createHistoryStore(() => storage, BASE)
    expect(store.save([conversation('c1', 10)], 'c1')).toEqual([])
    expect(storage.getItem(KEY)).toBeNull()
  })
})
