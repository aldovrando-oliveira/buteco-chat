import { contextBridge, ipcRenderer } from 'electron'
import type { ExposedApi } from '../shared/api'
import { IpcChannels } from '../shared/ipc-channels'

// Só o que já está implementado no main. Cada função chama um canal fixo: nada de envio genérico por canal.
const api: ExposedApi = {
  auth: {
    login: (serviceUrl, username, password) => ipcRenderer.invoke(IpcChannels.authLogin, serviceUrl, username, password),
    logout: () => ipcRenderer.invoke(IpcChannels.authLogout),
    status: () => ipcRenderer.invoke(IpcChannels.authStatus)
  }
}

contextBridge.exposeInMainWorld('buteco', api)
