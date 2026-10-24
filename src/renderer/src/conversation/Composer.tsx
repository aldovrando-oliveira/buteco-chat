import { ActionIcon, Box, Group, Stack, Text, Textarea } from '@mantine/core'
import { IconArrowUp } from '@tabler/icons-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH as MESSAGE_LIMIT } from '../../../shared/api'
import { formatCount } from './format'

export const COUNTER_FROM = 14_400

/**
 * Composer (D16): Enter envia, Shift+Enter quebra a linha, Enter durante composição de IME não envia. O texto acima
 * do limite não é cortado; o envio fica desabilitado.
 */
export function Composer(props: { placeholder: string; blocked: boolean; onSend: (text: string) => void }) {
  const { placeholder, blocked, onSend } = props
  const [text, setText] = useState('')
  const textarea = useRef<HTMLTextAreaElement>(null)
  // Último elemento que recebeu foco, por `focusin` no documento. Desabilitar o textarea tira o foco dele sem dar foco a
  // outro elemento (vai para o body, sem `focusin`), então o registro continua apontando para o textarea.
  const lastFocused = useRef<EventTarget | null>(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      lastFocused.current = event.target
      // Outro elemento recebeu foco durante o bloqueio: o usuário foi para outro lugar, e o foco não volta.
      if (event.target !== textarea.current) restoreFocus.current = false
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  // Foco devolvido ao fim do bloqueio só se estava no textarea quando o bloqueio começou (D18 #15).
  useEffect(() => {
    if (blocked) {
      restoreFocus.current = lastFocused.current === textarea.current && lastFocused.current !== null
      return
    }
    if (restoreFocus.current) textarea.current?.focus()
    restoreFocus.current = false
  }, [blocked])

  const overLimit = text.length > MESSAGE_LIMIT
  const canSend = !blocked && text.trim() !== '' && !overLimit

  function send() {
    if (!canSend) return
    onSend(text)
    setText('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    send()
  }

  return (
    <Stack gap={6} w="100%" maw={760} mx="auto" px={24} pb={16} pt={4}>
      <Group
        gap={8}
        align="flex-end"
        wrap="nowrap"
        p={8}
        bg="var(--mantine-color-body)"
        style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 11 }}
      >
        <Box style={{ flex: 1 }}>
          <Textarea
            ref={textarea}
            variant="unstyled"
            rows={2}
            aria-label="Mensagem"
            placeholder={placeholder}
            disabled={blocked}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            onKeyDown={onKeyDown}
            styles={{ input: { resize: 'none', paddingLeft: 4 } }}
          />
        </Box>
        <ActionIcon size={34} aria-label="Enviar mensagem" disabled={!canSend} onClick={send}>
          <IconArrowUp size={18} aria-hidden />
        </ActionIcon>
      </Group>
      <Group justify="space-between" gap={8}>
        <Text fz={11} c="dimmed">
          Enter envia · Shift+Enter quebra a linha
        </Text>
        {text.length >= COUNTER_FROM && (
          <Text fz={11} c="dimmed">
            {formatCount(text.length)} / {formatCount(MESSAGE_LIMIT)}
          </Text>
        )}
      </Group>
      {overLimit && (
        <Text fz={12} c="var(--mantine-color-red-text)">
          A mensagem passa do limite de {formatCount(MESSAGE_LIMIT)} caracteres.
        </Text>
      )}
    </Stack>
  )
}
