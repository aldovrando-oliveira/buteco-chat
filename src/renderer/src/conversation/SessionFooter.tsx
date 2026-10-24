import { ActionIcon, Box, Group, Stack, Text } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { parseServiceUrl } from '../../../shared/service-url'
import { initials } from './format'

const TICK_MS = 1000

export interface SessionInfo {
  username: string
  serviceUrl: string
  expiresAt: string
}

/**
 * Rodapé da barra lateral: avatar com iniciais, "{usuário} @ {host}", tempo restante e **Sair** só de ícone.
 * Era o destino provisório da login-operador (D14 de lá).
 */
export function SessionFooter(props: { session: SessionInfo; onLogout: () => void; onExpired: () => void }) {
  const { session, onLogout, onExpired } = props
  const expiresAtMs = Date.parse(session.expiresAt)
  const [now, setNow] = useState(Date.now)
  const remainingMs = expiresAtMs - now

  useEffect(() => {
    // Ao chegar a zero, quem decide é o main (status), sem mensagem: o aviso é da `sessao-expirada`.
    // Se o main ainda responder autenticado, tenta de novo no próximo tique.
    if (remainingMs <= 0) onExpired()
    const timer = setTimeout(() => setNow(Date.now()), remainingMs > 0 ? Math.min(TICK_MS, remainingMs) : TICK_MS)
    return () => clearTimeout(timer)
  }, [remainingMs, onExpired])

  const parsed = parseServiceUrl(session.serviceUrl)
  const host = parsed.ok ? parsed.host : session.serviceUrl
  const minutes = Math.max(0, Math.ceil(remainingMs / 60_000))

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="sm"
      px={14}
      py={12}
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Group gap={10} wrap="nowrap" miw={0}>
        <Box
          w={30}
          h={30}
          fz={11}
          fw={600}
          c="var(--mantine-color-anchor)"
          bg="var(--mantine-color-butecoBlue-light)"
          style={{ borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-hidden
        >
          {initials(session.username)}
        </Box>
        <Stack gap={2} miw={0}>
          <Group gap={6} wrap="nowrap" align="baseline" miw={0}>
            <Text fw={500} truncate="end">
              {session.username}
            </Text>
            <Text ff="monospace" fz={11} c="dimmed" truncate="end">
              @ {host}
            </Text>
          </Group>
          <Text fz={11} c="dimmed">
            Sessão válida por mais {minutes} min
          </Text>
        </Stack>
      </Group>
      <ActionIcon variant="subtle" color="gray" aria-label="Sair" onClick={onLogout}>
        <IconLogout size={18} aria-hidden />
      </ActionIcon>
    </Group>
  )
}
