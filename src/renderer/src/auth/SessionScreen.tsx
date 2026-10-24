import { ActionIcon, Group, Paper, Stack, Text } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { parseServiceUrl } from '../../../shared/service-url'

const TICK_MS = 1000

export interface SessionInfo {
  username: string
  serviceUrl: string
  expiresAt: string
}

/**
 * Destino pós-login provisório: será substituído pela tela de conversas na `conversa-a2a`.
 * Identificação no formato do rodapé da barra lateral do protótipo e **Sair** só de ícone (D14).
 */
export function SessionScreen(props: { session: SessionInfo; onLogout: () => void; onExpired: () => void }) {
  const { session, onLogout, onExpired } = props
  const expiresAtMs = Date.parse(session.expiresAt)
  const [now, setNow] = useState(Date.now)
  const remainingMs = expiresAtMs - now

  useEffect(() => {
    // Ao chegar a zero, quem decide é o main (status), sem mensagem: o aviso é da `sessao-expirada` (D8).
    // Se o main ainda responder autenticado, tenta de novo no próximo tique.
    if (remainingMs <= 0) onExpired()
    const timer = setTimeout(() => setNow(Date.now()), remainingMs > 0 ? Math.min(TICK_MS, remainingMs) : TICK_MS)
    return () => clearTimeout(timer)
  }, [remainingMs, onExpired])

  const parsed = parseServiceUrl(session.serviceUrl)
  const host = parsed.ok ? parsed.host : session.serviceUrl
  const minutes = Math.max(0, Math.ceil(remainingMs / 60_000))

  return (
    <Stack mih="100vh" justify="center" align="center" p="md">
      <Paper withBorder radius="lg" p="md" w="100%" maw={380}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
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
          <ActionIcon variant="subtle" color="gray" aria-label="Sair" onClick={onLogout}>
            <IconLogout size={18} aria-hidden />
          </ActionIcon>
        </Group>
      </Paper>
    </Stack>
  )
}
