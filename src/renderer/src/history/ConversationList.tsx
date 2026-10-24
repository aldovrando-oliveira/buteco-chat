import { ActionIcon, Box, Text, TextInput, UnstyledButton } from '@mantine/core'
import { IconSearch, IconTrash } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { SectionLabel } from '../components/SectionLabel'
import type { Conversation } from '../conversation/model'
import { GROUP_LABELS, GROUP_ORDER, groupOf, itemTime, matchesSearch, type ListGroup } from './list-format'

// Medidas do protótipo: busca com 34 px e raio 7 px (radius "sm"), sobre a superfície sutil.
const SEARCH_STYLES = {
  input: { height: 34, minHeight: 34, backgroundColor: 'var(--mantine-color-default-hover)' },
  section: { color: 'var(--mantine-color-dimmed)' }
}

export const NEW_CONVERSATION_TITLE = 'Nova conversa'

export function displayTitle(conversation: Conversation): string {
  return conversation.title ?? NEW_CONVERSATION_TITLE
}

function Item(props: {
  conversation: Conversation
  active: boolean
  now: number
  expired: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { conversation, active, now, expired, onSelect, onDelete } = props
  const title = displayTitle(conversation)
  return (
    <li className="buteco-history-item" data-active={active || undefined}>
      <UnstyledButton className="buteco-history-item-button" aria-current={active ? 'true' : undefined} onClick={onSelect}>
        <Text fz={13} fw={active ? 500 : 400} inherit truncate="end">
          {title}
        </Text>
        <Text fz={11} className="buteco-history-item-meta" truncate="end">
          {conversation.agent.name} · {itemTime(conversation.lastActivityAt, now)}
        </Text>
      </UnstyledButton>
      {/* O rascunho não tem nada a perder nem a guardar (historico-conversas, D16 #10). */}
      {conversation.turns.length > 0 && (
        <ActionIcon
          className="buteco-history-delete"
          variant="subtle"
          color="gray"
          size={26}
          aria-label={`Excluir conversa ${title}`}
          disabled={expired}
          onClick={onDelete}
        >
          <IconTrash size={15} aria-hidden />
        </ActionIcon>
      )}
    </li>
  )
}

/**
 * Busca e lista agrupada da barra lateral (historico-conversas, D16): grupos pela última atividade, só com itens, e o
 * item da conversa aberta com `aria-current`.
 */
export function ConversationList(props: {
  conversations: readonly Conversation[]
  openId: string | null
  /** Sessão expirada: a busca e a seleção continuam; Excluir fica bloqueado (D14). */
  expired: boolean
  onSelect: (conversationId: string) => void
  onDelete: (conversation: Conversation) => void
}) {
  const { conversations, openId, expired, onSelect, onDelete } = props
  const [query, setQuery] = useState('')
  const labelId = useId()
  const now = Date.now()

  const visible = conversations
    .filter((conversation) => matchesSearch(displayTitle(conversation), query))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
  const groups = new Map<ListGroup, Conversation[]>()
  for (const conversation of visible) {
    const group = groupOf(conversation.lastActivityAt, now)
    groups.set(group, [...(groups.get(group) ?? []), conversation])
  }

  return (
    <Box className="buteco-sidebar-history" data-testid="history">
      <Box px={14} pb={10}>
        <TextInput
          aria-label="Buscar conversas"
          placeholder="Buscar conversas"
          radius="sm"
          styles={SEARCH_STYLES}
          leftSection={<IconSearch size={15} aria-hidden />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </Box>
      <nav className="buteco-history-list" aria-label="Conversas">
        {visible.length === 0 && query.trim() !== '' && (
          <Text fz={13} c="dimmed" px={8} py={12}>
            Nenhuma conversa encontrada.
          </Text>
        )}
        {GROUP_ORDER.filter((group) => groups.has(group)).map((group) => (
          <section key={group} aria-labelledby={`${labelId}-${group}`}>
            <Box pt={12} px={8} pb={6}>
              <SectionLabel id={`${labelId}-${group}`}>{GROUP_LABELS[group]}</SectionLabel>
            </Box>
            <ul className="buteco-history-group">
              {groups.get(group)!.map((conversation) => (
                <Item
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === openId}
                  now={now}
                  expired={expired}
                  onSelect={() => onSelect(conversation.id)}
                  onDelete={() => onDelete(conversation)}
                />
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </Box>
  )
}
