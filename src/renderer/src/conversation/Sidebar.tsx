import { Button, Select, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import type { AgentSummary } from '../../../shared/api'
import { Brand } from '../auth/Brand'
import { SectionLabel } from '../components/SectionLabel'
import { ConversationList } from '../history/ConversationList'
import type { Conversation } from './model'
import { SessionFooter, type SessionInfo } from './SessionFooter'

// Medidas do protótipo: seletor e botão com 34 px; seletor com raio 7 px (radius "sm").
const SELECT_STYLES = { input: { height: 34, minHeight: 34 } }

/**
 * Seletor controlado pelo agente da conversa aberta: escolher outro só pede a troca, e o valor muda quando a conversa
 * muda. O agente guardado que não está na lista aparece desabilitado com " (inativo)"; antes da lista, desabilitado e
 * só com ele (historico-conversas, D12).
 */
function AgentSelect(props: {
  agents: AgentSummary[]
  agentsReady: boolean
  conversationAgent: AgentSummary | null
  disabled: boolean
  onSelect: (agent: AgentSummary) => void
}) {
  const { agents, agentsReady, conversationAgent, disabled, onSelect } = props
  const selectedId = conversationAgent?.id ?? null
  const data = agents.map((agent) => ({
    value: agent.id,
    label: agent.isActive ? agent.name : `${agent.name} (inativo)`,
    disabled: !agent.isActive
  }))
  if (conversationAgent !== null && !agents.some((agent) => agent.id === conversationAgent.id)) {
    const label = agentsReady ? `${conversationAgent.name} (inativo)` : conversationAgent.name
    data.push({ value: conversationAgent.id, label, disabled: true })
  }
  return (
    <Select
      aria-label="Agente"
      radius="sm"
      styles={SELECT_STYLES}
      allowDeselect={false}
      disabled={disabled || !agentsReady || agents.length === 0}
      value={selectedId}
      data={data}
      onChange={(id) => {
        const agent = agents.find((a) => a.id === id)
        if (agent && agent.id !== selectedId) onSelect(agent)
      }}
    />
  )
}

/** Barra lateral: marca, AGENTE + seletor, Nova conversa, busca e lista de conversas, e rodapé de sessão. */
export function Sidebar(props: {
  agents: AgentSummary[]
  agentsReady: boolean
  conversations: readonly Conversation[]
  openConversation: Conversation | null
  session: SessionInfo
  /** Sessão expirada: seletor, Nova conversa e Excluir bloqueados até o novo login (sessao-expirada, D9; D14). */
  expired: boolean
  onSelectAgent: (agent: AgentSummary) => void
  onNewConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversation: Conversation) => void
  onLogout: () => void
  onExpired: () => void
}) {
  const { agents, agentsReady, conversations, openConversation, session, expired } = props
  return (
    <aside className="buteco-sidebar">
      <Stack gap={14} p={14}>
        <Brand compact />
        <Stack gap={6}>
          <SectionLabel>AGENTE</SectionLabel>
          <AgentSelect
            agents={agents}
            agentsReady={agentsReady}
            conversationAgent={openConversation?.agent ?? null}
            disabled={expired}
            onSelect={props.onSelectAgent}
          />
        </Stack>
        <Button
          fullWidth
          h={34}
          leftSection={<IconPlus size={16} aria-hidden />}
          disabled={expired}
          onClick={props.onNewConversation}
        >
          Nova conversa
        </Button>
      </Stack>
      <ConversationList
        conversations={conversations}
        openId={openConversation?.id ?? null}
        expired={expired}
        onSelect={props.onSelectConversation}
        onDelete={props.onDeleteConversation}
      />
      <SessionFooter session={session} expired={expired} onLogout={props.onLogout} onExpired={props.onExpired} />
    </aside>
  )
}
