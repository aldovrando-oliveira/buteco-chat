// Verificação de tipo (roda no `typecheck`, não no Vitest): o renderer só enxerga o que o preload expõe.

export const exposed = [window.buteco.auth, window.buteco.agents, window.buteco.chat, window.buteco.clipboard]

// @ts-expect-error o token nunca cruza a ponte: `getToken` não existe no renderer.
export const noToken = window.buteco.auth.getToken

// @ts-expect-error `discard` só existe no main (sessao-expirada, D3).
export const noDiscard = window.buteco.auth.discard
