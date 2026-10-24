/**
 * Único ponto que decide de onde vem o renderer (design D7). Janela, política de navegação e validação de IPC
 * derivam daqui. Dev é decidido por `!isPackaged`; a variável de ambiente sozinha nunca liga o modo dev.
 */
export type Runtime = { kind: 'dev-server'; url: string; origin: string } | { kind: 'file' }

export function resolveRuntime(isPackaged: boolean, rendererUrlEnv: string | undefined): Runtime {
  if (isPackaged || !rendererUrlEnv) return { kind: 'file' }
  let parsed: URL
  try {
    parsed = new URL(rendererUrlEnv)
  } catch {
    return { kind: 'file' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { kind: 'file' }
  return { kind: 'dev-server', url: parsed.href, origin: parsed.origin }
}

/** Origem do dev server quando ela vale, ou `null` (app empacotado, ou sem servidor de dev). */
export function devServerOrigin(runtime: Runtime): string | null {
  return runtime.kind === 'dev-server' ? runtime.origin : null
}
