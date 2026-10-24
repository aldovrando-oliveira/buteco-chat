import type { ExposedApi } from '../../shared/api'

declare global {
  interface Window {
    buteco: ExposedApi
  }
}
