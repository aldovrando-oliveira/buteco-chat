// Verificação de tipo (roda no `typecheck`, não no Vitest): o renderer só enxerga os namespaces expostos.

export const exposed = window.buteco.auth

// @ts-expect-error `chat` ainda não é exposto pelo preload.
export const notExposed = window.buteco.chat
