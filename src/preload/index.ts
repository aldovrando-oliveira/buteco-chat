import { contextBridge } from 'electron'
import type { ExposedApi } from '../shared/api'

// Só o que já está implementado no main. Nesta change, nada.
const api: ExposedApi = {}

contextBridge.exposeInMainWorld('buteco', api)
