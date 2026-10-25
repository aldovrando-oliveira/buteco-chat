import { Text } from '@mantine/core'
import { IconClock, IconLock, IconServer } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import type { SessionInfo } from './SessionFooter'

const TICK_MS = 1000
const ICON_SIZE = 12

/**
 * Barra de status no rodapé da janela (barra-de-status-e-marca, D1): endereço completo do serviço e tempo de sessão.
 * Dona do relógio que antes era do rodapé da barra lateral; a regra é a mesma. Não é `role="status"`: uma região viva
 * anunciaria cada minuto, e a expiração já tem o banner com `role="alert"`.
 */
export function StatusBar(props: {
  session: Pick<SessionInfo, 'serviceUrl' | 'expiresAt'>
  expired: boolean
  onExpired: () => void
}) {
  const { session, expired, onExpired } = props
  const expiresAtMs = Date.parse(session.expiresAt)
  const [now, setNow] = useState(Date.now)
  const remainingMs = expiresAtMs - now

  // Novo login: o relógio parou no vencimento, e o tempo restante é contado de novo a partir de agora.
  useEffect(() => setNow(Date.now()), [session.expiresAt])

  useEffect(() => {
    // Ao chegar a zero, a sessão expira direto, sem `status()`: main e renderer usam o mesmo relógio
    // (sessao-expirada, D1). O contador para até um novo login trocar o `expiresAt`.
    if (remainingMs <= 0) {
      onExpired()
      return
    }
    const timer = setTimeout(() => setNow(Date.now()), Math.min(TICK_MS, remainingMs))
    return () => clearTimeout(timer)
  }, [remainingMs, onExpired])

  const minutes = Math.max(0, Math.ceil(remainingMs / 60_000))

  return (
    <footer className="buteco-statusbar" aria-label="Barra de status">
      <div className="buteco-statusbar-group buteco-statusbar-service">
        <IconServer size={ICON_SIZE} aria-hidden style={{ flexShrink: 0 }} />
        <Text span inherit ff="monospace" truncate="end" title={session.serviceUrl}>
          {session.serviceUrl}
        </Text>
      </div>
      {expired ? (
        <div className="buteco-statusbar-group buteco-statusbar-session">
          <IconLock size={ICON_SIZE} aria-hidden color="var(--mantine-color-red-text)" />
          <Text span inherit fw={500} c="var(--mantine-color-red-text)">
            Sessão expirada
          </Text>
        </div>
      ) : (
        <div className="buteco-statusbar-group buteco-statusbar-session">
          <IconClock size={ICON_SIZE} aria-hidden />
          <span>Sessão válida por mais {minutes} min</span>
        </div>
      )}
    </footer>
  )
}
