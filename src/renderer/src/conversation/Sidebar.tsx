import { Box, Button, Select, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import type { AgentSummary } from '../../../shared/api'
import { Brand } from '../auth/Brand'
import { SectionLabel } from '../components/SectionLabel'
import { SessionFooter, type SessionInfo } from './SessionFooter'

// Medidas do protótipo: seletor e botão com 34 px; seletor com raio 7 px (radius "sm").
const SELECT_STYLES = { input: { height: 34, minHeight: 34 } }

/**
 * Seletor controlado pelo agente da conversa: escolher outro só pede a troca; o valor muda quando a conversa muda,
 * então Cancelar no modal devolve o seletor ao agente atual (D13).
 */
function AgentSelect(props: {
  agents: AgentSummary[]
  selectedId: string | null
  disabled: boolean
  onSelect: (agent: AgentSummary) => void
}) {
  const { agents, selectedId, disabled, onSelect } = props
  return (
    <Select
      aria-label="Agente"
      radius="sm"
      styles={SELECT_STYLES}
      allowDeselect={false}
      disabled={disabled}
      value={selectedId}
      data={agents.map((agent) => ({
        value: agent.id,
        label: agent.isActive ? agent.name : `${agent.name} (inativo)`,
        disabled: !agent.isActive
      }))}
      onChange={(id) => {
        const agent = agents.find((a) => a.id === id)
        if (agent && agent.id !== selectedId) onSelect(agent)
      }}
    />
  )
}

/** Barra lateral: marca, AGENTE + seletor, Nova conversa, espaço reservado do histórico e rodapé de sessão. */
export function Sidebar(props: {
  agents: AgentSummary[]
  selectedId: string | null
  session: SessionInfo
  onSelectAgent: (agent: AgentSummary) => void
  onNewConversation: () => void
  onLogout: () => void
  onExpired: () => void
}) {
  const { agents, selectedId, session, onSelectAgent, onNewConversation, onLogout, onExpired } = props
  return (
    <aside className="buteco-sidebar">
      <Stack gap={14} p={14}>
        <Brand compact />
        <Stack gap={6}>
          <SectionLabel>AGENTE</SectionLabel>
          <AgentSelect agents={agents} selectedId={selectedId} disabled={agents.length === 0} onSelect={onSelectAgent} />
        </Stack>
        <Button fullWidth h={34} leftSection={<IconPlus size={16} aria-hidden />} onClick={onNewConversation}>
          Nova conversa
        </Button>
      </Stack>
      {/* Busca e lista de conversas: `historico-conversas`. */}
      <Box className="buteco-sidebar-history" data-testid="history-placeholder" />
      <SessionFooter session={session} onLogout={onLogout} onExpired={onExpired} />
    </aside>
  )
}
