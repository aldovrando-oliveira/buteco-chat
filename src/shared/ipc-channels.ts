/**
 * Canais IPC entre preload e main, no formato `<namespace>:<acao>` (ex.: `auth:login`, `chat:send`).
 * Cada change acrescenta os do namespace que implementa.
 */
export const IpcChannels = {
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  authStatus: 'auth:status'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
