// Verificação de tipo (roda no `typecheck`, não no Vitest): o renderer não enxerga namespaces ainda não expostos.

// @ts-expect-error `auth` ainda não é exposto pelo preload.
export const notExposed = window.buteco.auth
