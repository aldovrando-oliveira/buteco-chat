import { ActionIcon, Box, Group, Text } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { initials } from './format'

export interface SessionInfo {
  username: string
  serviceUrl: string
  expiresAt: string
}

/**
 * Rodapé da barra lateral: avatar com iniciais, nome do usuário e **Sair** só de ícone. O endereço e o tempo de sessão
 * ficam na barra de status (barra-de-status-e-marca, D2).
 */
export function SessionFooter(props: { username: string; onLogout: () => void }) {
  const { username, onLogout } = props
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="sm"
      px={14}
      py={8}
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
          {initials(username)}
        </Box>
        <Text fw={500} truncate="end">
          {username}
        </Text>
      </Group>
      <ActionIcon variant="subtle" color="gray" aria-label="Sair" onClick={onLogout}>
        <IconLogout size={18} aria-hidden />
      </ActionIcon>
    </Group>
  )
}
