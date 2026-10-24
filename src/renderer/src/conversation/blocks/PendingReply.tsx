import { Group, Text } from '@mantine/core'
import { shortTaskId, stateLabel } from '../format'
import { AgentAvatar } from './AgentReply'

/** Resposta pendente: avatar com ponto animado e pílula "Processando" com o estado real (D18 #7). */
export function PendingReply({ taskId, state }: { taskId: string | null; state: string }) {
  return (
    <Group gap={10} align="center" wrap="nowrap" role="status">
      <AgentAvatar pending />
      <Group
        gap={8}
        px={12}
        py={6}
        wrap="nowrap"
        bg="var(--mantine-color-body)"
        style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 9 }}
      >
        <Group gap={3} wrap="nowrap" aria-hidden>
          <span className="buteco-dot" />
          <span className="buteco-dot" />
          <span className="buteco-dot" />
        </Group>
        <Text fz={12} c="dimmed">
          Processando
        </Text>
        {taskId !== null && (
          <Text ff="monospace" fz={11} c="dimmed">
            task {shortTaskId(taskId)} · {stateLabel(state)}
          </Text>
        )}
      </Group>
    </Group>
  )
}
