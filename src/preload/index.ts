import { contextBridge, ipcRenderer } from 'electron'
import type { ExposedApi } from '../shared/api'
import { IpcChannels } from '../shared/ipc-channels'

// Só o que já está implementado no main. Cada função chama um canal fixo: nada de envio genérico por canal.
const api: ExposedApi = {
  auth: {
    login: (serviceUrl, username, password) => ipcRenderer.invoke(IpcChannels.authLogin, serviceUrl, username, password),
    logout: () => ipcRenderer.invoke(IpcChannels.authLogout),
    status: () => ipcRenderer.invoke(IpcChannels.authStatus)
  },
  agents: {
    list: () => ipcRenderer.invoke(IpcChannels.agentsList)
  },
  chat: {
    send: (agentId, text, contextId) => ipcRenderer.invoke(IpcChannels.chatSend, agentId, text, contextId),
    getTask: (agentId, taskId) => ipcRenderer.invoke(IpcChannels.chatGetTask, agentId, taskId)
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke(IpcChannels.clipboardWriteText, text)
  }
}

contextBridge.exposeInMainWorld('buteco', api)
