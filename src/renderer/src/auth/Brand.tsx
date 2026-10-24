import { Group, Text } from '@mantine/core'
import { IconMessageCircle } from '@tabler/icons-react'

/**
 * Marca: balão de conversa na cor primária, "Buteco" e "Chat". Centralizada (16 px) nas telas de entrada; compacta
 * (14 px, alinhada à esquerda) no topo da barra lateral.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Group gap={compact ? 6 : 8} justify={compact ? 'flex-start' : 'center'} wrap="nowrap">
      <IconMessageCircle size={compact ? 18 : 24} color="var(--mantine-color-anchor)" aria-hidden />
      <Text fz={compact ? 14 : 16} lh={1}>
        <Text span inherit fw={600}>
          Buteco
        </Text>{' '}
        <Text span inherit c="dimmed">
          Chat
        </Text>
      </Text>
    </Group>
  )
}
