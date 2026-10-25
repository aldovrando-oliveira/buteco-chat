import { Group, Text } from '@mantine/core'
import { AppIcon } from './AppIcon'

/**
 * Marca: ícone do app, "Buteco" e "Chat". Centralizada (ícone de 32 px, texto de 16 px) nas telas de entrada; compacta
 * (ícone de 24 px, texto de 14 px, alinhada à esquerda) no topo da barra lateral (barra-de-status-e-marca, D5).
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Group gap={compact ? 6 : 8} justify={compact ? 'flex-start' : 'center'} wrap="nowrap">
      <AppIcon size={compact ? 24 : 32} />
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
