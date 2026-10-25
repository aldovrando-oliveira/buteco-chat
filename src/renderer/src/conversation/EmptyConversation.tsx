import { Badge, Group, Paper, Stack, Text } from '@mantine/core'
import type { AgentSummary } from '../../../shared/api'
import { SectionLabel } from '../components/SectionLabel'

/** Cartão centralizado da área principal, usado pela conversa vazia e pelos estados da lista de agentes. */
export function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <Stack style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} justify="center" align="center" p="md">
      <Paper withBorder radius="lg" p={24} w="100%" maw={480}>
        {children}
      </Paper>
    </Stack>
  )
}

/** Conversa vazia: "NOVA CONVERSA COM", nome, descrição, skills e a nota de quando a conversa entra no histórico. */
export function EmptyConversation({ agent }: { agent: AgentSummary }) {
  return (
    <CenteredCard>
      <Stack gap={10}>
        <SectionLabel>NOVA CONVERSA COM</SectionLabel>
        <Text fz={17} fw={600}>
          {agent.name}
        </Text>
        {agent.description !== null && <Text c="dimmed">{agent.description}</Text>}
        {agent.skills.length > 0 && (
          <Group gap={6}>
            {agent.skills.map((skill) => (
              <Badge key={skill.name} variant="light" color="gray" styles={{ root: { textTransform: 'none', fontWeight: 500 } }}>
                {skill.name}
              </Badge>
            ))}
          </Group>
        )}
        <Text fz={12} c="dimmed">
          A conversa entra no histórico depois da primeira mensagem.
        </Text>
      </Stack>
    </CenteredCard>
  )
}
