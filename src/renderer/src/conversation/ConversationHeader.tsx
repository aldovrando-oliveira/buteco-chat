import { Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconCopy } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { abbreviateContextId } from './format'
import type { AgentStatus } from './use-conversation'

export const COPIED_MS = 1500

const BADGE_STYLES = { root: { textTransform: 'none' as const, fontWeight: 500 } }

/** Copiar o contextId completo; o texto vira "Copiado" por 1,5 s. A cópia passa pelo main (D6). */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <UnstyledButton
      fz={11}
      c="dimmed"
      onClick={() => {
        void window.buteco.clipboard.writeText(value).then(() => setCopied(true))
      }}
    >
      <Group gap={3} wrap="nowrap">
        <IconCopy size={12} aria-hidden />
        {copied ? 'Copiado' : 'Copiar'}
      </Group>
    </UnstyledButton>
  )
}

/**
 * Cabeçalho da área principal: título, contextId com Copiar, selo do agente e selo Ativo/Inativo. Com o agente ainda
 * desconhecido, só o selo do nome (historico-conversas, D12).
 */
export function ConversationHeader(props: {
  title: string | null
  contextId: string | null
  agentName: string
  agentStatus: AgentStatus
}) {
  const { title, contextId, agentName, agentStatus } = props
  return (
    <Group
      component="header"
      justify="space-between"
      wrap="nowrap"
      gap="md"
      px={24}
      py={12}
      bg="var(--mantine-color-body)"
      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
    >
      <Stack gap={2} miw={0}>
        <Text component="h2" m={0} fz={15} fw={600} truncate="end">
          {title ?? 'Nova conversa'}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Text fz={12} c="dimmed">
            contextId
          </Text>
          {contextId === null ? (
            <Text fz={12} c="dimmed">
              — aguardando o primeiro envio
            </Text>
          ) : (
            <>
              <Text ff="monospace" fz={11} c="dimmed" title={contextId}>
                {abbreviateContextId(contextId)}
              </Text>
              <CopyButton value={contextId} />
            </>
          )}
        </Group>
      </Stack>
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Badge variant="light" color="gray" styles={BADGE_STYLES}>
          {agentName}
        </Badge>
        {agentStatus === 'active' && (
          <Badge variant="light" color="green" c="var(--buteco-color-success-text)" styles={BADGE_STYLES}>
            Ativo
          </Badge>
        )}
        {agentStatus === 'inactive' && (
          <Badge variant="light" color="gray" styles={BADGE_STYLES}>
            Inativo
          </Badge>
        )}
      </Group>
    </Group>
  )
}
