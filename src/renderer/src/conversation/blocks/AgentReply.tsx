import { Box, Group, Stack, Text } from '@mantine/core'
import { IconRobot } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { formatSeconds, formatTime, shortTaskId } from '../format'
import { Markdown } from '../Markdown'

const AVATAR = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--mantine-color-body)',
  border: '1px solid var(--mantine-color-default-border)'
} as const

/** Avatar circular de 26 px do agente; no pendente, com um ponto animado no lugar do robô. */
export function AgentAvatar({ pending = false }: { pending?: boolean }) {
  return (
    <Box style={AVATAR} aria-hidden>
      {pending ? <span className="buteco-dot" /> : <IconRobot size={15} color="var(--mantine-color-anchor)" />}
    </Box>
  )
}

/** Linha de metadados em mono 11 px, cor secundária. */
export function MetaLine({ children }: { children: ReactNode }) {
  return (
    <Text ff="monospace" fz={11} c="dimmed">
      {children}
    </Text>
  )
}

export function AgentReply(props: {
  agentName: string
  taskId: string
  text: string
  receivedAt: number
  durationSeconds: number
}) {
  const { agentName, taskId, text, receivedAt, durationSeconds } = props
  return (
    <Group gap={10} align="flex-start" wrap="nowrap" data-testid="agent-reply">
      <AgentAvatar />
      <Stack gap={4} miw={0} style={{ flex: 1 }}>
        <Group gap={6} align="baseline">
          <Text fz={12} fw={600}>
            {agentName}
          </Text>
          <Text fz={11} c="dimmed">
            {formatTime(receivedAt)}
          </Text>
        </Group>
        {text.trim() === '' ? <Text c="dimmed">O agente não devolveu texto.</Text> : <Markdown text={text} />}
        <MetaLine>
          task {shortTaskId(taskId)} · Completed · {formatSeconds(durationSeconds)} s
        </MetaLine>
      </Stack>
    </Group>
  )
}
