import { Box, Button, Group, Stack, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import type { ExpiredCase } from './use-conversation'

/** Linha explicativa por caso (sessao-expirada, D11 #1). A de `poll` é a do protótipo. */
const DETAIL: Record<ExpiredCase, string> = {
  poll: 'A resposta em andamento continua sendo processada. Entre de novo para retomá-la — nada será reenviado.',
  send: 'Sua mensagem ainda não foi enviada. Entre de novo para enviá-la — ela será enviada uma única vez.',
  idle: 'Entre de novo para continuar.'
}

/** Banner acima do composer, na coluna de 760 px: amarelo claro, cadeado e **Entrar novamente** (sessao-expirada, D11). */
export function SessionExpiredBanner(props: { expiredCase: ExpiredCase; onRelogin: () => void }) {
  return (
    <Box w="100%" maw={760} mx="auto" px={24} pt={4}>
      <Group
        role="alert"
        gap={10}
        px={12}
        py={10}
        wrap="nowrap"
        align="center"
        bg="var(--mantine-color-yellow-light)"
        c="var(--buteco-color-warning-text)"
        style={{ borderRadius: 9 }}
      >
        <IconLock size={18} aria-hidden style={{ flexShrink: 0 }} />
        <Stack gap={2} miw={0} style={{ flex: 1 }}>
          <Text fw={600} inherit>
            Sua sessão expirou.
          </Text>
          <Text c="var(--mantine-color-text)">{DETAIL[props.expiredCase]}</Text>
        </Stack>
        <Button size="xs" style={{ flexShrink: 0 }} onClick={props.onRelogin}>
          Entrar novamente
        </Button>
      </Group>
    </Box>
  )
}
