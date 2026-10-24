import { parseServiceUrl } from '../../../shared/service-url'

/** Único dado de login lembrado entre aberturas (o usuário não é lembrado). */
export const SERVICE_URL_KEY = 'buteco-chat:service-url'

/** Endereço salvo e ainda válido, já normalizado, ou `null` (nada salvo, valor inválido ou sem armazenamento). */
export function readSavedServiceUrl(): string | null {
  try {
    const value = localStorage.getItem(SERVICE_URL_KEY)
    if (value === null) return null
    const parsed = parseServiceUrl(value)
    return parsed.ok ? parsed.baseUrl : null
  } catch {
    return null
  }
}

/** Chamado só depois de um login bem-sucedido. Sem armazenamento, o próximo acesso é tratado como o primeiro. */
export function saveServiceUrl(baseUrl: string): void {
  try {
    localStorage.setItem(SERVICE_URL_KEY, baseUrl)
  } catch {
    // Armazenamento indisponível: nada a fazer.
  }
}
