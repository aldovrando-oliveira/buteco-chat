import { MantineProvider } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { ConversationScreen } from './conversation/ConversationScreen'
import type { SessionInfo } from './conversation/SessionFooter'
import { cssVariablesResolver } from './theme/css-variables'
import { theme } from './theme/theme'

/** Navegação por estado (D10). O estado inicial vem do main: o renderer pode ter sido recarregado com sessão ativa. */
type View = { kind: 'checking' } | { kind: 'login' } | { kind: 'session'; session: SessionInfo }

async function currentView(): Promise<View> {
  const status = await window.buteco.auth.status()
  if (status.authenticated && status.serviceUrl !== null && status.username !== null && status.expiresAt !== null) {
    return { kind: 'session', session: { serviceUrl: status.serviceUrl, username: status.username, expiresAt: status.expiresAt } }
  }
  return { kind: 'login' }
}

// Sem ColorSchemeScript: é script inline e a CSP de produção o bloqueia (design D10 da fundação).
export function App() {
  const [view, setView] = useState<View>({ kind: 'checking' })

  const refresh = useCallback(async () => setView(await currentView()), [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await window.buteco.auth.logout()
    setView({ kind: 'login' })
  }, [])

  // Novo login no modal da sessão expirada: mesmo serviço e usuário, só o `expiresAt` muda (sessao-expirada, D2).
  const renewed = useCallback((expiresAt: string) => {
    setView((current) =>
      current.kind === 'session' ? { kind: 'session', session: { ...current.session, expiresAt } } : current
    )
  }, [])

  const refreshView = useCallback(() => void refresh(), [refresh])
  const handleLogout = useCallback(() => void logout(), [logout])

  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      {view.kind === 'login' && <LoginScreen onLoggedIn={refreshView} />}
      {view.kind === 'session' && (
        <ConversationScreen session={view.session} onLogout={handleLogout} onRenewed={renewed} />
      )}
    </MantineProvider>
  )
}
