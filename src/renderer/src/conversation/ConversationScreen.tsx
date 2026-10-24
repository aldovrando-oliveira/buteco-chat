import { Box, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { AgentSummary } from '../../../shared/api'
import { StateBlock } from './blocks/StateBlock'
import { Composer } from './Composer'
import { ConversationHeader } from './ConversationHeader'
import { CenteredCard, EmptyConversation } from './EmptyConversation'
import { ReloginModal } from './ReloginModal'
import { SessionExpiredBanner } from './SessionExpiredBanner'
import type { SessionInfo } from './SessionFooter'
import { Sidebar } from './Sidebar'
import { Timeline } from './Timeline'
import { useConversation } from './use-conversation'

/** Pedido de descarte da conversa atual (D13): Nova conversa ou troca de agente. */
type Discard = { kind: 'new' } | { kind: 'switch'; agent: AgentSummary }

const PENDING_NOTE = 'A resposta pendente também será descartada.'

function placeholderFor(agentName: string | null, busy: boolean, agentActive: boolean, expired: boolean): string {
  if (expired) return 'Entre novamente para continuar'
  if (agentName === null) return 'Mensagem para o agente'
  if (busy) return 'Aguardando a resposta do agente…'
  if (!agentActive) return `${agentName} está inativo. Escolha outro agente ou comece uma nova conversa.`
  return `Mensagem para ${agentName}`
}

/** Tela de conversas (capacidade `conversa`): barra lateral e área principal com cabeçalho, timeline e composer. */
export function ConversationScreen(props: {
  session: SessionInfo
  onLogout: () => void
  /** Novo login no modal: o `App` troca só o `expiresAt`, sem desmontar a tela (sessao-expirada, D2). */
  onRenewed: (expiresAt: string) => void
}) {
  const { session, onLogout, onRenewed } = props
  const chat = useConversation()
  const [discard, setDiscard] = useState<Discard | null>(null)
  const [relogin, setRelogin] = useState(false)
  const { agents, conversation, busy, agentActive, expired, expiredCase } = chat

  const hasMessages = conversation !== null && conversation.turns.length > 0

  function apply(request: Discard) {
    if (request.kind === 'switch') chat.startConversation(request.agent, false)
    else if (conversation !== null) chat.startConversation(conversation.agent, true)
  }

  function requestDiscard(request: Discard) {
    // Conversa vazia: nada a perder, sem confirmação.
    if (hasMessages) setDiscard(request)
    else apply(request)
  }

  function logout() {
    // Antes do logout: nenhuma consulta pode terminar em `unauthorized` depois dele.
    chat.stop()
    onLogout()
  }

  const agentList = agents.kind === 'ready' ? agents.agents : []
  const blocked = expired || conversation === null || busy || !agentActive

  function loggedInAgain(expiresAt: string) {
    setRelogin(false)
    onRenewed(expiresAt)
    chat.renew()
  }

  return (
    <div className="buteco-conversation">
      <Sidebar
        agents={agentList}
        selectedId={conversation?.agent.id ?? null}
        session={session}
        expired={expired}
        onSelectAgent={(agent) => requestDiscard({ kind: 'switch', agent })}
        onNewConversation={() => (conversation === null ? chat.retryAgents() : requestDiscard({ kind: 'new' }))}
        onLogout={logout}
        onExpired={chat.expire}
      />
      <main className="buteco-main">
        {conversation !== null && (
          <ConversationHeader
            title={conversation.title}
            contextId={conversation.contextId}
            agentName={conversation.agent.name}
            agentActive={agentActive}
          />
        )}
        <MainArea chat={chat} />
        {expired && <SessionExpiredBanner expiredCase={expiredCase} onRelogin={() => setRelogin(true)} />}
        <Composer
          placeholder={placeholderFor(conversation?.agent.name ?? null, busy, agentActive, expired)}
          blocked={blocked}
          onSend={chat.send}
        />
      </main>
      <ReloginModal
        opened={expired && relogin}
        session={session}
        expiredCase={expiredCase}
        onClose={() => setRelogin(false)}
        onLoggedIn={loggedInAgain}
      />
      <Modal opened={discard !== null} onClose={() => setDiscard(null)} withCloseButton={false} centered>
        <Stack gap={16}>
          <Text>
            {discard?.kind === 'switch'
              ? 'Trocar de agente começa uma nova conversa e descarta a atual.'
              : 'Começar uma nova conversa descarta a atual.'}
            {busy && ` ${PENDING_NOTE}`}
          </Text>
          <Group justify="flex-end" gap={8}>
            <Button variant="default" onClick={() => setDiscard(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (discard !== null) apply(discard)
                setDiscard(null)
              }}
            >
              {discard?.kind === 'switch' ? 'Trocar de agente' : 'Começar nova conversa'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}

/** Área entre o cabeçalho e o composer: estados da lista de agentes, conversa vazia ou timeline (D12, D18 #9). */
function MainArea({ chat }: { chat: ReturnType<typeof useConversation> }) {
  const { agents, conversation } = chat
  // 401 na primeira carga: só o banner, até o novo login refazer a carga (sessao-expirada, D8).
  if (chat.expired && agents.kind === 'loading' && conversation === null) return <Box style={{ flex: 1 }} />
  if (agents.kind === 'loading' && conversation === null) {
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
  if (conversation === null) {
    const empty = agents.kind === 'ready' && agents.agents.length === 0
    return (
      <CenteredCard>
        <Text c="dimmed">{empty ? 'Nenhum agente cadastrado na plataforma.' : 'Nenhum agente ativo no momento.'}</Text>
      </CenteredCard>
    )
  }
  if (conversation.turns.length === 0) return <EmptyConversation agent={conversation.agent} />
  return (
    <Timeline
      turns={conversation.turns}
      agentName={conversation.agent.name}
      actions={{ resend: chat.resend, keepWaiting: chat.keepWaiting, disabled: chat.expired }}
    />
  )
}
