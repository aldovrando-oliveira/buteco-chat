import { Box, Divider, Group, Stack, Text } from '@mantine/core'
import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { AgentReply, AgentAvatar } from './blocks/AgentReply'
import { PendingReply } from './blocks/PendingReply'
import { StateBlock } from './blocks/StateBlock'
import { UserMessage } from './blocks/UserMessage'
import { dayLabel, isSameDay, shortTaskId, stateLabel } from './format'
import type { Attempt, Turn } from './model'

const NEAR_BOTTOM_PX = 80

export interface TimelineActions {
  resend(turnId: number): void
  keepWaiting(turnId: number): void
  /** Sessão expirada: Reenviar e Continuar aguardando ficam desabilitados (sessao-expirada, D9). */
  disabled: boolean
}

function DaySeparator({ label }: { label: string }) {
  return (
    <Group gap={10} wrap="nowrap">
      <Divider style={{ flex: 1 }} />
      <Text fz={11} c="dimmed">
        {label}
      </Text>
      <Divider style={{ flex: 1 }} />
    </Group>
  )
}

/** Bloco de estado ao lado do avatar, alinhado como uma resposta do agente. */
function AgentSide({ children }: { children: ReactNode }) {
  return (
    <Group gap={10} align="flex-start" wrap="nowrap">
      <AgentAvatar />
      <Box miw={0} style={{ flex: 1 }}>
        {children}
      </Box>
    </Group>
  )
}

function AttemptView({ turn, agentName, actions }: { turn: Turn; agentName: string; actions: TimelineActions }) {
  const attempt: Attempt = turn.attempt
  const resend = { label: 'Reenviar', onClick: () => actions.resend(turn.id), disabled: actions.disabled }
  switch (attempt.kind) {
    case 'sending':
      return <PendingReply taskId={null} state="TASK_STATE_SUBMITTED" />
    case 'pending':
      return <PendingReply taskId={attempt.taskId} state={attempt.state} />
    case 'awaiting-login':
      return attempt.resume === 'poll' ? (
        <PendingReply taskId={attempt.taskId} state={attempt.state} label="Aguardando novo login para retomar" />
      ) : (
        <PendingReply taskId={null} state="TASK_STATE_SUBMITTED" label="Aguardando novo login para enviar" />
      )
    case 'completed':
      return (
        <AgentReply
          agentName={agentName}
          taskId={attempt.taskId}
          text={attempt.text}
          receivedAt={attempt.receivedAt}
          durationSeconds={attempt.durationSeconds}
        />
      )
    case 'failed':
      return (
        <AgentSide>
          <StateBlock
            title="O agente não conseguiu responder."
            detail="A plataforma não informa o motivo. Você pode reenviar a mensagem."
            meta={`task ${shortTaskId(attempt.taskId)} · Failed`}
            actions={[resend]}
          />
        </AgentSide>
      )
    case 'rejected':
      return (
        <AgentSide>
          <StateBlock
            title="O agente não aceitou a mensagem: pode estar inativo ou sem modelo configurado."
            meta={`task ${shortTaskId(attempt.taskId)} · Rejected`}
          />
        </AgentSide>
      )
    case 'timeout':
      return (
        <AgentSide>
          <StateBlock
            title="O agente não respondeu a tempo."
            detail="Se a primeira tentativa terminar depois, o agente pode ver a pergunta duas vezes."
            meta={`task ${shortTaskId(attempt.taskId)} · ${stateLabel(attempt.lastState)}`}
            actions={[
              { label: 'Continuar aguardando', onClick: () => actions.keepWaiting(turn.id), disabled: actions.disabled },
              resend
            ]}
          />
        </AgentSide>
      )
    case 'poll-error':
      return (
        <AgentSide>
          <StateBlock
            title="Não foi possível acompanhar a resposta do agente."
            meta={`task ${shortTaskId(attempt.taskId)}`}
            actions={[resend]}
          />
        </AgentSide>
      )
    case 'send-error':
      // `rpc`: a plataforma respondeu e recusou; nos outros casos o envio é ambíguo e o texto não afirma nada (D10).
      return (
        <AgentSide>
          {attempt.error.kind === 'rpc' ? (
            <StateBlock
              title="A plataforma recusou a mensagem."
              detail={attempt.error.message}
              meta={`erro ${attempt.error.code}`}
              actions={[resend]}
            />
          ) : (
            <StateBlock
              title="Não foi possível confirmar o envio da mensagem."
              detail="Confira a conexão com o serviço e tente de novo."
              actions={[resend]}
            />
          )}
        </AgentSide>
      )
    // Normalização ao reabrir (historico-conversas, D15).
    case 'interrupted':
      return (
        <AgentSide>
          <StateBlock
            title="Não foi possível confirmar o envio da mensagem."
            detail="O app foi fechado durante o envio."
            actions={[resend]}
          />
        </AgentSide>
      )
    case 'not-sent':
      return (
        <AgentSide>
          <StateBlock
            title="A mensagem não foi enviada."
            detail="A sessão terminou antes do envio. Você pode enviá-la de novo."
            actions={[resend]}
          />
        </AgentSide>
      )
  }
}

/** Timeline: coluna central de até 760 px, 18 px entre itens, separador antes do primeiro item de cada dia. */
export function Timeline(props: { turns: Turn[]; agentName: string; actions: TimelineActions }) {
  const { turns, agentName, actions } = props
  const scroller = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)

  // Rola para o fim quando chega um item novo, se o usuário já estava perto do fim (D20).
  useEffect(() => {
    const element = scroller.current
    if (element && nearBottom.current) element.scrollTop = element.scrollHeight
  }, [turns])

  const now = Date.now()
  return (
    <Box
      ref={scroller}
      style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
      onScroll={(event) => {
        const element = event.currentTarget
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX
      }}
    >
      <Stack gap={18} maw={760} mx="auto" px={24} py={20}>
        {turns.map((turn, index) => {
          const previous = turns[index - 1]
          const newDay = previous === undefined || !isSameDay(previous.sentAt, turn.sentAt)
          return (
            <Fragment key={turn.id}>
              {newDay && <DaySeparator label={dayLabel(turn.sentAt, now)} />}
              <UserMessage text={turn.text} sentAt={turn.sentAt} />
              <AttemptView turn={turn} agentName={agentName} actions={actions} />
            </Fragment>
          )
        })}
      </Stack>
    </Box>
  )
}
