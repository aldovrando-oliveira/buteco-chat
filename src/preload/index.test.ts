import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPOSED_NAMESPACES, type ExposedApi } from '../shared/api'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn(async () => 'resposta')
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke } }))

async function exposedApi(): Promise<ExposedApi> {
  await import('./index')
  const [, api] = exposeInMainWorld.mock.calls[0] ?? []
  return api as ExposedApi
}

describe('preload', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    invoke.mockClear()
    vi.resetModules()
  })

  it('expõe só window.buteco, com exatamente os namespaces de ExposedApi', async () => {
    await import('./index')

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    const [name, api] = exposeInMainWorld.mock.calls[0] ?? []
    expect(name).toBe('buteco')
    expect(Object.keys(api as object).sort()).toEqual([...EXPOSED_NAMESPACES].sort())
    expect(EXPOSED_NAMESPACES).toEqual(['auth', 'agents', 'chat', 'clipboard'])
  })

  it('auth tem exatamente login, logout e status (sem acesso ao token)', async () => {
    const api = await exposedApi()

    expect(Object.keys(api.auth).sort()).toEqual(['login', 'logout', 'status'])
  })

  it('agents, chat e clipboard têm só as funções do contrato', async () => {
    const api = await exposedApi()

    expect(Object.keys(api.agents)).toEqual(['list'])
    expect(Object.keys(api.chat).sort()).toEqual(['getTask', 'send'])
    expect(Object.keys(api.clipboard)).toEqual(['writeText'])
  })

  it('cada função chama o seu canal com os argumentos recebidos e devolve a resposta', async () => {
    const api = await exposedApi()

    const agent = '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f'

    await expect(api.auth.login('http://localhost:5017', 'ana', 's3nha')).resolves.toBe('resposta')
    await api.auth.logout()
    await api.auth.status()
    await expect(api.agents.list()).resolves.toBe('resposta')
    await api.chat.send(agent, 'oi', null)
    await api.chat.getTask(agent, 't-1')
    await api.clipboard.writeText('ctx-1')

    expect(invoke.mock.calls).toEqual([
      ['auth:login', 'http://localhost:5017', 'ana', 's3nha'],
      ['auth:logout'],
      ['auth:status'],
      ['agents:list'],
      ['chat:send', agent, 'oi', null],
      ['chat:getTask', agent, 't-1'],
      ['clipboard:writeText', 'ctx-1']
    ])
  })
})
