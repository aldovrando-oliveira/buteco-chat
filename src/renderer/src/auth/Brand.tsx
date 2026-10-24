import { Group, Text } from '@mantine/core'
import { IconMessageCircle } from '@tabler/icons-react'

/** Marca do topo das telas de entrada: balão de conversa na cor primária, "Buteco" e "Chat". */
export function Brand() {
  return (
    <Group gap={8} justify="center" wrap="nowrap">
      <IconMessageCircle size={24} color="var(--mantine-color-anchor)" aria-hidden />
      <Text fz={16} lh={1}>
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
