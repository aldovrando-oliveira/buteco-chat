import { Box, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { DeleteConversationModal } from '../history/DeleteConversationModal'
import { StateBlock } from './blocks/StateBlock'
import { Composer } from './Composer'
import { ConversationHeader } from './ConversationHeader'
import { CenteredCard, EmptyConversation } from './EmptyConversation'
import type { Conversation } from './model'
import { ReloginModal } from './ReloginModal'
import { SessionExpiredBanner } from './SessionExpiredBanner'
import type { SessionInfo } from './SessionFooter'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { Timeline } from './Timeline'
import { useConversation, type AgentsState, type AgentStatus } from './use-conversation'

/** Último turno com uma resposta que a exclusão descartaria (historico-conversas, D13). */
const PENDING_KINDS = ['sending', 'pending', 'timeout', 'awaiting-login']

function placeholderFor(
  agentName: string | null,
  busy: boolean,
  agentStatus: AgentStatus,
  agents: AgentsState,
  expired: boolean
): string {
  if (expired) return 'Entre novamente para continuar'
  if (agentName === null) return 'Mensagem para o agente'
  if (busy) return 'Aguardando a resposta do agente…'
  // Conversa guardada aberta antes da lista (historico-conversas, D12).
  if (agentStatus === 'unknown') return agents.kind === 'error' ? 'Agentes indisponíveis no momento' : 'Carregando agentes…'
  if (agentStatus === 'inactive') return `${agentName} está inativo. Escolha outro agente ou comece uma nova conversa.`
  return `Mensagem para ${agentName}`
}

/**
 * Tela de conversas (capacidade `conversa`): barra lateral e área principal com cabeçalho, timeline e composer, e a
 * barra de status no rodapé da janela.
 */
export function ConversationScreen(props: {
  session: SessionInfo
  onLogout: () => void
  /** Novo login no modal: o `App` troca só o `expiresAt`, sem desmontar a tela (sessao-expirada, D2). */
  onRenewed: (expiresAt: string) => void
}) {
  const { session, onLogout, onRenewed } = props
  const chat = useConversation(session.serviceUrl)
  const [relogin, setRelogin] = useState(false)
  const [deleting, setDeleting] = useState<Conversation | null>(null)
  const { agents, conversation, busy, agentStatus, expired, expiredCase } = chat

  function logout() {
    // Antes do logout: nenhuma consulta pode terminar em `unauthorized` depois dele.
    chat.stop()
    onLogout()
  }

  const agentList = agents.kind === 'ready' ? agents.agents : []
  const blocked = expired || conversation === null || busy || agentStatus !== 'active'

  function loggedInAgain(expiresAt: string) {
    setRelogin(false)
    onRenewed(expiresAt)
    chat.renew()
  }

  // Lido da lista atual: a conversa pode ter mudado desde o clique na lixeira.
  const toDelete = deleting === null ? null : (chat.conversations.find((c) => c.id === deleting.id) ?? null)
  const toDeletePending = toDelete !== null && PENDING_KINDS.includes(toDelete.turns.at(-1)?.attempt.kind ?? '')

  return (
    <div className="buteco-conversation">
      <div className="buteco-workspace">
        <Sidebar
          agents={agentList}
          agentsReady={agents.kind === 'ready'}
          conversations={chat.conversations}
          openConversation={conversation}
          session={session}
          expired={expired}
          onSelectAgent={chat.selectAgent}
          onNewConversation={chat.newConversation}
          onSelectConversation={chat.select}
          onDeleteConversation={setDeleting}
          onLogout={logout}
        />
        <main className="buteco-main">
          {conversation !== null && (
            <ConversationHeader
              title={conversation.title}
              startedAt={conversation.turns[0]?.sentAt ?? null}
              contextId={conversation.contextId}
              agentName={conversation.agent.name}
              agentStatus={agentStatus}
            />
          )}
          <MainArea chat={chat} />
          {/* Falha da primeira carga com uma conversa aberta: a conversa continua legível (historico-conversas, D12). */}
          {conversation !== null && agents.kind === 'error' && (
            <Box w="100%" maw={760} mx="auto" px={24} pt={4}>
              <StateBlock title="Não foi possível carregar os agentes." actions={[{ label: 'Tentar de novo', onClick: chat.retryAgents }]} />
            </Box>
          )}
          {expired && <SessionExpiredBanner expiredCase={expiredCase} onRelogin={() => setRelogin(true)} />}
          <Composer
            placeholder={placeholderFor(conversation?.agent.name ?? null, busy, agentStatus, agents, expired)}
            blocked={blocked}
            onSend={chat.send}
          />
        </main>
      </div>
      <StatusBar session={session} expired={expired} onExpired={chat.expire} />
      <ReloginModal
        opened={expired && relogin}
        session={session}
        expiredCase={expiredCase}
        onClose={() => setRelogin(false)}
        onLoggedIn={loggedInAgain}
      />
      <DeleteConversationModal
        opened={toDelete !== null && !expired}
        pending={toDeletePending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (toDelete !== null) chat.remove(toDelete.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}

/** Área entre o cabeçalho e o composer: estados da lista de agentes, conversa vazia ou timeline (D12, D18 #9). */
function MainArea({ chat }: { chat: ReturnType<typeof useConversation> }) {
  const { agents, conversation } = chat
  if (conversation !== null) {
    if (conversation.turns.length === 0) return <EmptyConversation agent={conversation.agent} />
    // `key`: ao abrir outra conversa, a timeline monta de novo e rola até o fim (historico-conversas, D11).
    return (
      <Timeline
        key={conversation.id}
        turns={conversation.turns}
        agentName={conversation.agent.name}
        actions={{ resend: chat.resend, keepWaiting: chat.keepWaiting, disabled: chat.expired }}
      />
    )
  }
  // 401 na primeira carga: só o banner, até o novo login refazer a carga (sessao-expirada, D8).
  if (chat.expired && agents.kind === 'loading') return <Box style={{ flex: 1 }} />
  if (agents.kind === 'loading') {
    return (
      <Stack style={{ flex: 1 }} justify="center" align="center">
        <Text c="dimmed">Carregando agentes…</Text>
      </Stack>
    )
  }
  if (agents.kind === 'error') {
    return (
      <Stack style={{ flex: 1 }} justify="center" align="center" p="md">
        <StateBlock title="Não foi possível carregar os agentes." actions={[{ label: 'Tentar de novo', onClick: chat.retryAgents }]} />
      </Stack>
    )
  }
  const empty = agents.agents.length === 0
  return (
    <CenteredCard>
      <Text c="dimmed">{empty ? 'Nenhum agente cadastrado na plataforma.' : 'Nenhum agente ativo no momento.'}</Text>
    </CenteredCard>
  )
}
