/**
 * Canais IPC entre preload e main, no formato `<namespace>:<acao>` (ex.: `auth:login`, `chat:send`).
 * Nenhum canal existe ainda: cada change acrescenta os do namespace que implementa.
 */
export const IpcChannels = {} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
