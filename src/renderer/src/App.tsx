import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { SessionScreen, type SessionInfo } from './auth/SessionScreen'
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

  // Estáveis: o SessionScreen depende deles no efeito do contador.
  const refreshView = useCallback(() => void refresh(), [refresh])
  const handleLogout = useCallback(() => void logout(), [logout])

  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      <Notifications />
      {view.kind === 'login' && <LoginScreen onLoggedIn={refreshView} />}
      {view.kind === 'session' && (
        <SessionScreen session={view.session} onLogout={handleLogout} onExpired={refreshView} />
      )}
    </MantineProvider>
  )
}
